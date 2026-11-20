"""Run the personal GigaChat essay reviewer on loopback (Python 3.9+)."""
import argparse
import json
import os
import ssl
import threading
import uuid
import webbrowser
from html.parser import HTMLParser
from http.client import HTTPException
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, HTTPSHandler, Request, build_opener

OAUTH = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
CHAT = "https://api.giga.chat/v1/chat/completions"
MODEL = "GigaChat-2"
MAX_CARDS = 2
CRITERIA = ("K1", "K2", "K3", "K4", "K5")
INPUT_LIMITS = {"topic": 500, "essay": 20000, "key": 4096}
# Also allow a JSON encoder that uses one six-byte escape per UTF-16 unit.
MAX_BODY = 160 * 1024
MAX_PROVIDER_BODY = 128 * 1024

# The family ZIP and single-page download contain the identical self-contained launcher.
EMBEDDED_RESOURCES = None  # __INCLUDE_REVIEW_BUNDLE__


def get_resources():
    if EMBEDDED_RESOURCES is not None:
        return EMBEDDED_RESOURCES
    # Only the editable repository version uses the build-time reading catalogue.
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    try:
        from essay_workshop.review_package import review_bundle
        return review_bundle()
    finally:
        sys.path.pop(0)


RESOURCES = get_resources()
SYSTEM_PROMPT = RESOURCES["systemPrompt"]
CARD_BY_ID = {card["id"]: card for card in RESOURCES["cards"]}
METHOD_VERSION = RESOURCES["method"]["version"]
MATERIALS_ID = RESOURCES["materialsId"]
STATUS = {"service": "uzel-essay-full-review", "version": 1,
          "methodVersion": METHOD_VERSION, "materialsId": MATERIALS_ID, "maxCards": MAX_CARDS}


class Problem(Exception):
    def __init__(self, status, code):
        super().__init__(code)
        self.status, self.code = status, code


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def parse_json(raw):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("duplicate member")
            result[key] = value
        return result

    return json.loads(raw, object_pairs_hook=unique)


def transport(cafile=None):
    context = ssl.create_default_context()
    if cafile:
        context.load_verify_locations(cafile=cafile)
    opener = build_opener(NoRedirect(), HTTPSHandler(context=context))

    def post(url, headers, body):
        req = Request(url, data=body, method="POST", headers={**headers, "Accept": "application/json"})
        try:
            with opener.open(req, timeout=65) as response:
                raw = response.read(MAX_PROVIDER_BODY + 1)
        except HTTPError as err:
            status = err.code
            err.close()
            raise Problem(status, "provider_http") from None
        except URLError as err:
            if isinstance(err.reason, ssl.SSLCertVerificationError):
                raise Problem(503, "tls_certificate") from None
            if isinstance(err.reason, TimeoutError):
                raise Problem(504, "upstream_timeout") from None
            raise Problem(503, "upstream_unavailable") from None
        except TimeoutError:
            raise Problem(504, "upstream_timeout") from None
        except (HTTPException, OSError):
            raise Problem(503, "upstream_unavailable") from None
        if len(raw) > MAX_PROVIDER_BODY:
            raise Problem(502, "invalid_response")
        try:
            result = parse_json(raw.decode("utf-8"))
        except (ValueError, RecursionError):
            raise Problem(502, "invalid_response") from None
        if not isinstance(result, dict):
            raise Problem(502, "invalid_response")
        return result
    return post


def utf16_length(text):
    return len(text.encode("utf-16-le")) // 2


def check_input(data):
    if not isinstance(data, dict) or set(data) - {"cardIds"} != set(INPUT_LIMITS):
        raise Problem(400, "invalid_input")
    for name, limit in INPUT_LIMITS.items():
        s = data[name]
        if not isinstance(s, str) or not s.strip():
            raise Problem(400, "invalid_input")
        try:
            length = utf16_length(s)
        except UnicodeEncodeError:
            raise Problem(400, "invalid_input") from None
        if length > limit:
            raise Problem(413, "too_large")
    key = data["key"].strip()
    if key.startswith("Basic "):
        key = key[6:].strip()
    if not key or not key.isascii() or not key.isprintable() or any(ch.isspace() for ch in key):
        raise Problem(400, "invalid_input")
    card_ids = data.get("cardIds", [])
    if (not isinstance(card_ids, list) or len(card_ids) > MAX_CARDS
            or any(not isinstance(cid, str) or cid not in CARD_BY_ID for cid in card_ids)
            or len(set(card_ids)) != len(card_ids)):
        raise Problem(400, "invalid_cards")
    return key


def verified_review(data, essay):
    def valid_text(s, limit, empty=False):
        return isinstance(s, str) and (bool(s.strip()) or (empty and s == "")) and utf16_length(s) <= limit

    try:
        if not isinstance(data, dict) or set(data) != {"criteria", "priority"} or not valid_text(data["priority"], 1500):
            raise ValueError
        if not isinstance(data["criteria"], list) or len(data["criteria"]) != len(CRITERIA):
            raise ValueError
        indexed, dropped = {}, []
        for row in data["criteria"]:
            if not isinstance(row, dict) or set(row) != {"id", "quote", "comment", "action"}:
                raise ValueError
            cid = row["id"]
            if cid not in CRITERIA or cid in indexed:
                raise ValueError
            q = row["quote"]
            if (not valid_text(q, 1800, empty=True) or not valid_text(row["comment"], 2000)
                    or not valid_text(row["action"], 1500)):
                raise ValueError
            if q and q not in essay:
                dropped.append(cid)
                indexed[cid] = {"id": cid, "quote": "", "comment": "Предложенную выдержку не удалось найти в твоём тексте. Замечание по ней снято.",
                                "action": "Выбери в своей работе фразу для обсуждения этого критерия."}
            else:
                indexed[cid] = {"id": cid, "quote": q, "comment": row["comment"].strip(), "action": row["action"].strip()}
        criteria = [indexed[cid] for cid in CRITERIA]
        priority = data["priority"].strip()
        if dropped:
            # A priority written by the model can also rely on a discarded passage.
            priority = next((row["action"] for row in criteria if row["quote"]), "Найди в своей работе фразу, которую ты хочешь обсудить.")
        return {"review": {"criteria": criteria, "priority": priority}, "unverifiedQuotes": sorted(dropped)}
    except (ValueError, TypeError, KeyError):
        raise Problem(502, "invalid_response") from None


def request_review(data, post):
    key = check_input(data)
    try:
        auth = post(OAUTH, {"Authorization": "Basic " + key, "RqUID": str(uuid.uuid4()),
                            "Content-Type": "application/x-www-form-urlencoded"}, b"scope=GIGACHAT_API_PERS")
    except Problem as err:
        if err.code != "provider_http":
            raise
        if err.status in (400, 401, 403):
            raise Problem(401, "authorization_failed") from None
        if err.status == 429:
            raise Problem(429, "rate_limit") from None
        raise Problem(502, "upstream_unavailable") from None
    token = auth.get("access_token")
    if not isinstance(token, str) or not token or not token.isascii() or not token.isprintable() or any(ch.isspace() for ch in token):
        raise Problem(502, "invalid_response")
    material = {"topic": data["topic"], "essay": data["essay"]}
    if data.get("cardIds"):
        material["cards"] = [CARD_BY_ID[cid] for cid in data["cardIds"]]
    user = json.dumps(material, ensure_ascii=False)
    payload = {"model": MODEL, "stream": False, "max_tokens": 2400,
               "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user}]}
    try:
        reply = post(CHAT, {"Authorization": "Bearer " + token, "Content-Type": "application/json"}, json_bytes(payload))
    except Problem as err:
        if err.code != "provider_http":
            raise
        if err.status in (401, 403):
            raise Problem(403, "access_denied") from None
        if err.status == 402:
            raise Problem(402, "quota_unavailable") from None
        if err.status == 429:
            raise Problem(429, "rate_limit") from None
        raise Problem(502, "upstream_unavailable") from None
    try:
        choice = reply["choices"][0]
        if choice.get("finish_reason") != "stop":
            raise Problem(502, "incomplete_response")
        message = choice["message"]
        if message.get("role") != "assistant" or not isinstance(message["content"], str):
            raise ValueError
        text = message["content"].strip()
        if text.startswith(("```json\n", "```\n")) and text.endswith("\n```"):
            text = text.split("\n", 1)[1][:-4]
        content = parse_json(text)
    except (ValueError, KeyError, TypeError, IndexError, AttributeError, RecursionError):
        raise Problem(502, "invalid_response") from None
    return {**verified_review(content, data["essay"]), "methodVersion": METHOD_VERSION, "materialsId": MATERIALS_ID}


def make_server(page, post, port=0):
    slot = threading.BoundedSemaphore(1)

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(15)

        def log_message(self, *args):
            pass

        def respond(self, status, value, html=False):
            body = value if html else json_bytes(value)
            self.send_response(status)
            self.send_header("Content-Type", ("text/html" if html else "application/json") + "; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            if html:
                self.send_header("Content-Security-Policy",
                                 "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
                                 "img-src data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(body)

        def local(self):
            return self.headers.get_all("Host") == [f"127.0.0.1:{self.server.server_port}"]

        def do_GET(self):
            if not self.local():
                self.respond(403, {"error": "invalid_host"})
            elif self.path == "/api/status":
                self.respond(200, STATUS)
            elif self.path in ("/", "/essay-check.html"):
                self.respond(200, page, html=True)
            else:
                self.respond(404, {"error": "not_found"})

        def do_POST(self):
            try:
                origin = f"http://127.0.0.1:{self.server.server_port}"
                if not self.local() or self.headers.get_all("Origin") != [origin]:
                    raise Problem(403, "origin_not_allowed")
                if self.path != "/api/review":
                    raise Problem(404, "not_found")
                if len(self.headers.get_all("Content-Type") or []) != 1 or self.headers.get_content_type() != "application/json":
                    raise Problem(415, "expected_json")
                lengths = self.headers.get_all("Content-Length") or []
                if self.headers.get_all("Transfer-Encoding") or len(lengths) != 1 or not lengths[0].isascii() or not lengths[0].isdigit():
                    raise Problem(400, "invalid_length")
                if len(lengths[0]) > 6 or int(lengths[0]) > MAX_BODY:
                    raise Problem(413, "too_large")
                raw = self.rfile.read(int(lengths[0]))
                if len(raw) != int(lengths[0]):
                    raise Problem(400, "invalid_length")
                try:
                    data = parse_json(raw.decode("utf-8"))
                except (ValueError, RecursionError):
                    raise Problem(400, "invalid_json") from None
                if not slot.acquire(blocking=False):
                    raise Problem(429, "request_in_progress")
                try:
                    result = request_review(data, post)
                finally:
                    slot.release()
            except Problem as error:
                self.respond(error.status, {"error": error.code})
            except (TimeoutError, ConnectionError, OSError):
                self.respond(503, {"error": "connection_unavailable"})
            else:
                self.respond(200, result)

    class LocalServer(ThreadingHTTPServer):
        # Disconnected browser tabs and socket-level errors do not produce request logs.
        def handle_error(self, request, client_address):
            pass

    return LocalServer(("127.0.0.1", port), Handler)


class AppMarker(HTMLParser):
    def __init__(self):
        super().__init__()
        self.found = False

    def handle_starttag(self, tag, attrs):
        if tag == "meta":
            attributes = dict(attrs)
            if attributes.get("name") == "uzel-app" and attributes.get("content") == "essay-review":
                self.found = True


def find_page(folder, html):
    if html:
        return html
    for name in ("essay-check.html", "Proverka_sochineniya.html"):
        candidate = folder / name
        if candidate.is_file():
            return candidate
    found = []
    for candidate in folder.glob("*.html"):
        parser = AppMarker()
        with candidate.open(encoding="utf-8-sig", errors="replace") as source:
            parser.feed(source.read(128 * 1024))
        if parser.found:
            found.append(candidate)
    if len(found) != 1:
        raise ValueError("page not identified")
    return found[0]


def main():
    parser = argparse.ArgumentParser(description="Личная проверка итогового сочинения с GigaChat")
    parser.add_argument("--port", type=int, default=8766, help="локальный порт (по умолчанию 8766)")
    parser.add_argument("--html", type=Path, help="путь к странице с тренажёром")
    parser.add_argument("--ca-file", type=Path, help="PEM с доверенными сертификатами для TLS")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--open", dest="open_browser", action="store_true", help="открыть страницу в браузере")
    group.add_argument("--no-open", dest="open_browser", action="store_false", help="вывести ссылку без открытия браузера")
    parser.set_defaults(open_browser=True)
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("Порт должен быть от 0 до 65535.")
    try:
        folder = Path(__file__).resolve().parent
        page = find_page(folder, args.html).read_bytes()
    except (OSError, ValueError):
        parser.exit(1, "Положите HTML-файл тренажёра рядом с программой или передайте путь к нему через --html.\n")
    try:
        post = transport(args.ca_file or os.environ.get("GIGACHAT_CA_FILE"))
    except (OSError, ValueError):
        parser.exit(1, "Проверьте путь к PEM-файлу сертификатов.\n")
    try:
        server = make_server(page, post, args.port)
    except OSError:
        parser.exit(1, "Не удалось занять локальный порт. Закройте другой экземпляр программы или укажите --port.\n")
    with server:
        address = f"http://127.0.0.1:{server.server_port}/"
        print("Личная проверка сочинения:", address, flush=True)
        print("Для завершения нажмите Ctrl+C в этом окне.", flush=True)
        if args.open_browser:
            webbrowser.open(address)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
