"""Original reading cards. Selection alternatives are not extra mandatory works."""

GRADES = {}

def grade(number, subtitle, focus):
    GRADES[number] = dict(number=number, subtitle=subtitle, focus=focus, units=[])

def unit(number, title, reading, analysis, quote, dialogue, practice, art='', lesson=''):
    items = GRADES[number]['units']
    items.append(dict(id=f'unit-{len(items)+1:02d}', title=title, reading=reading,
        analysis=analysis, quote=quote, dialogue=dialogue, practice=practice,
        art=art.split('|',1)[0], art_note=art.split('|',1)[1] if '|' in art else '', lesson=lesson))

def units(number, rows):
 for row in rows.strip().splitlines():
  parts = [s.strip() for s in row.split('¦')]
  if len(parts) < 6 or len(parts) > 8:
   raise ValueError((number, parts))
  unit(number, *parts)

def load_grades():
    if GRADES:
        return GRADES
    import school_primary
    import school_middle
    import school_senior
    return GRADES
