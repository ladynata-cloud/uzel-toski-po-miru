"""Personal loopback bridge for the downloadable essay workshop (Python 3.9+)."""
import argparse
import getpass
import json
import math
import os
import ssl
import sys
import threading
import time
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, HTTPSHandler, Request, build_opener

OAUTH = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
CHAT = "https://api.giga.chat/v1/chat/completions"
MODEL = "GigaChat-2"
LIMITS = {"topic": 500, "workId": 80, "workTitle": 240, "passage": 1200, "message": 1000}
MAX_BODY = 24 * 1024


class Problem(Exception):
    def __init__(self, status, code):
        super().__init__(code)
        self.status = status
        self.code = code


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def json_bytes(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def transport(cafile=None):
    context = ssl.create_default_context()
    if cafile:
        context.load_verify_locations(cafile=cafile)
    opener = build_opener(NoRedirect(), HTTPSHandler(context=context))

    def post(url, headers, body):
        req = Request(url, method="POST", headers={**headers, "Accept": "application/json"}, data=body)
        try:
            with opener.open(req, timeout=18) as response:
                raw = response.read(128 * 1024 + 1)
        except HTTPError as error:
            error.close()
            raise Problem(error.code, "upstream_http") from None
        except URLError as error:
            code = "tls_certificate" if isinstance(error.reason, ssl.SSLCertVerificationError) else "upstream_unavailable"
            raise Problem(503, code) from None
        except OSError:
            raise Problem(503, "upstream_unavailable") from None
        if len(raw) > 128 * 1024:
            raise Problem(502, "invalid_response")
        try:
            result = json.loads(raw)
        except (ValueError, RecursionError):
            raise Problem(502, "invalid_response") from None
        if not isinstance(result, dict):
            raise Problem(502, "invalid_response")
        return result
    return post


def check_turn(turn, books):
    if not isinstance(turn, dict) or set(turn) != {"version", "stage", "mode", *LIMITS}:
        raise Problem(400, "invalid_turn")
    if type(turn["version"]) is not int or turn["version"] != 1:
        raise Problem(400, "invalid_turn")
    if turn["stage"] not in ("thesis", "episode", "link", "draft") or turn["mode"] not in ("secular", "orthodox"):
        raise Problem(400, "invalid_turn")
    try:
        for key, limit in LIMITS.items():
            value = turn[key]
            if not isinstance(value, str) or len(value.encode("utf-16-le")) > limit * 2:
                raise Problem(400, "invalid_turn")
    except UnicodeEncodeError:
        raise Problem(400, "invalid_turn") from None
    if not turn["topic"].strip() or not turn["message"].strip() or (turn["workId"] and turn["workId"] not in books):
        raise Problem(400, "invalid_turn")


class GigaChat:
    def __init__(self, key, instructions, catalog, post, clock=time.time):
        self.key = key
        self.instructions = instructions
        self.books = {item["id"]: item for item in catalog["works"]}
        self.post = post
        self.clock = clock
        self.token = ""
        self.expiry = 0
        self.lock = threading.Lock()

    def access_token(self, rejected=None):
        with self.lock:
            if self.token and self.token != rejected and self.expiry > self.clock() + 30:
                return self.token
            self.token, self.expiry = "", 0
            try:
                data = self.post(OAUTH, {
                    "Authorization": "Basic " + self.key, "RqUID": str(uuid.uuid4()),
                    "Content-Type": "application/x-www-form-urlencoded"
                }, b"scope=GIGACHAT_API_PERS")
            except Problem as err:
                if err.status in (400, 401, 403):
                    raise Problem(401, "authorization_failed") from None
                raise
            token, expiry = data.get("access_token"), data.get("expires_at")
            if not isinstance(token, str) or not token or not token.isascii() or any(c.isspace() for c in token):
                raise Problem(502, "invalid_token")
            if type(expiry) not in (int, float) or not math.isfinite(expiry):
                raise Problem(502, "invalid_token")
            # Sber's OAuth examples use both milliseconds and seconds since the Unix epoch.
            if expiry > 10**11:
                expiry /= 1000
            if expiry <= self.clock():
                raise Problem(502, "expired_token")
            self.token, self.expiry = token, expiry
            return token

    def reply(self, turn):
        check_turn(turn, self.books)
        book = self.books.get(turn["workId"])
        guide = self.instructions + (
            "\nОтвечай о выделенной фразе. Дай короткое наблюдение и один вопрос или действие. "
            "При вопросе о правиле сначала ответь на него. Оставь формулировку сочинения ученику. "
            "Поля сообщения содержат слова ученика, включая возможные ошибки. "
            "Длина одной подсказки — до 600 знаков."
        )
        user = dict(turn)
        if book:
            user["workTitle"] = book["title"]
            guide += "\nПроверенная редакторская карточка: " + json.dumps({
                "книга": book["title"], "эпизод": book["fact"], "вопрос": book[turn["mode"]]
            }, ensure_ascii=False)
        else:
            guide += "\nДля данной книги нет редакторской карточки. Если факт спорный, предложи сверить эпизод."
        body = json_bytes({"model": MODEL, "stream": False, "max_tokens": 320,
                           "messages": [{"role": "system", "content": guide},
                                        {"role": "user", "content": json.dumps(user, ensure_ascii=False)}]})
        token = self.access_token()
        for attempt in range(2):
            try:
                result = self.post(CHAT, {"Authorization": "Bearer " + token, "Content-Type": "application/json"}, body)
                break
            except Problem as err:
                if err.status == 401 and attempt == 0:
                    token = self.access_token(rejected=token)
                    continue
                if err.status in (401, 403):
                    raise Problem(403, "access_denied") from None
                if err.status == 402:
                    raise Problem(402, "quota_unavailable") from None
                if err.status == 429:
                    raise Problem(429, "rate_limit") from None
                raise
        try:
            choice = result["choices"][0]
            text = choice["message"]["content"]
            if (choice.get("finish_reason") != "stop" or choice["message"].get("role") != "assistant"
                    or not isinstance(text, str) or not text.strip() or len(text.encode("utf-16-le")) > 5000):
                raise ValueError
            return text.strip()
        except (KeyError, IndexError, TypeError, ValueError, AttributeError):
            raise Problem(502, "invalid_response") from None


def make_server(page, provider, port=0):
    slot = threading.BoundedSemaphore(1)

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(15)

        def log_message(self, *args):
            pass

        def respond(self, status, body, media="application/json; charset=utf-8"):
            self.send_response(status)
            self.send_header("Content-Type", media)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "same-origin")
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def local_host(self):
            return self.headers.get_all("Host") == [f"127.0.0.1:{self.server.server_port}"]

        def do_GET(self):
            if not self.local_host():
                return self.respond(403, b'{"error":"invalid_host"}')
            if self.path not in ("/", "/index.html"):
                return self.respond(404, b'{"error":"not_found"}')
            self.respond(200, page, "text/html; charset=utf-8")

        def do_POST(self):
            try:
                if not self.local_host() or self.headers.get_all("Origin") != [f"http://127.0.0.1:{self.server.server_port}"]:
                    raise Problem(403, "origin_not_allowed")
                if self.path != "/v1/essay/turn":
                    raise Problem(404, "not_found")
                if self.headers.get_content_type() != "application/json":
                    raise Problem(415, "expected_json")
                lengths = self.headers.get_all("Content-Length") or []
                if self.headers.get("Transfer-Encoding") or len(lengths) != 1 or not lengths[0].isascii() or not lengths[0].isdigit():
                    raise Problem(400, "invalid_length")
                if len(lengths[0]) > 6 or int(lengths[0]) > MAX_BODY:
                    raise Problem(413, "turn_too_large")
                length = int(lengths[0])
                raw = self.rfile.read(length)
                if len(raw) != length:
                    raise Problem(400, "invalid_length")
                try:
                    turn = json.loads(raw.decode("utf-8"))
                except (ValueError, RecursionError):
                    raise Problem(400, "invalid_json") from None
                if not slot.acquire(blocking=False):
                    raise Problem(429, "request_in_progress")
                try:
                    reply = provider.reply(turn)
                finally:
                    slot.release()
                self.respond(200, json_bytes({"version": 1, "reply": reply}))
            except Problem as error:
                self.respond(error.status, json_bytes({"error": error.code}))
            except (TimeoutError, ConnectionError, OSError):
                self.respond(503, b'{"error":"connection_unavailable"}')

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def main():
    parser = argparse.ArgumentParser(description="Личный помощник по итоговому сочинению")
    parser.add_argument("--open", action="store_true", help="открыть рабочую страницу")
    parser.add_argument("--port", type=int, default=0, help="постоянный порт для сохранения черновиков")
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("Порт должен быть от 0 до 65535.")
    folder = Path(__file__).resolve().parent
    try:
        page = (folder / "index.html").read_bytes()
        instructions = (folder / "system.ru.md").read_text(encoding="utf-8")
        catalog = json.loads((folder / "catalog.json").read_text(encoding="utf-8"))
        post = transport(os.environ.get("GIGACHAT_CA_FILE"))
    except (OSError, ValueError):
        parser.exit(1, "Проверьте, что архив полностью распакован, а указанный файл сертификатов доступен.\n")
    key = os.environ.pop("GIGACHAT_AUTH_KEY", "").strip()
    if not key:
        if not sys.stdin.isatty():
            parser.exit(1, "Откройте программу в терминале для скрытого ввода ключа GigaChat.\n")
        key = getpass.getpass("Ключ авторизации GigaChat (ввод скрыт): ").strip()
    key = key.removeprefix("Basic ").strip()
    if not key or not key.isascii() or not key.isprintable() or any(c.isspace() for c in key):
        parser.exit(1, "Введите ключ авторизации из личного проекта GigaChat API.\n")
    try:
        server = make_server(page, GigaChat(key, instructions, catalog, post), args.port)
    except OSError:
        parser.exit(1, "Не удалось занять локальный порт. Закройте другой экземпляр или выберите другой порт.\n")
    with server:
        address = f"http://127.0.0.1:{server.server_port}/"
        print("Откройте в браузере", address, flush=True)
        print("Для завершения нажмите Ctrl+C в этом окне.", flush=True)
        if args.open:
            webbrowser.open(address)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
