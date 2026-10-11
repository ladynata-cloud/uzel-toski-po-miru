"""Original, individually written extensions of all programme blocks."""
DETAILS = {}

def add(grade, text):
    for number, block in enumerate(text.strip().split('\n%%\n'), 1):
        paragraphs = [p.strip() for p in block.strip().split('\n\n') if p.strip()]
        if len(paragraphs) < 2:
            raise ValueError(('Missing analytical paragraph', grade, number))
        DETAILS[(grade, f'unit-{number:02d}')] = paragraphs

def load_depth():
    if not DETAILS:
        import depth_primary
        import depth_middle
        import depth_senior
    return DETAILS
