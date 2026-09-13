"""Pure-SVG component demo, not a requirement that task media must all be SVG.

Synthetic six-second, three-shot fixture; references are listed in README.md.

Cuts at exactly 2 and 4 seconds. No story assets, rig, limbs or fake audio.
Author geometry in a 640x360 viewBox; renderer supplies output dimensions.
"""


def bodybox(x, y, scale=1):
    return f'''<g transform="translate({x} {y}) scale({scale})">
      <ellipse cy="8" rx="35" ry="9" fill="#101b2b" opacity=".4"/>
      <rect x="-25" y="-94" width="50" height="94" rx="12" fill="#f5b85b"/>
      <path d="M 15 -84 L 25 -76 L 25 -20 L 15 -12 Z" fill="#d18b3a"/>
      <rect x="-14" y="-120" width="28" height="24" rx="7" fill="#ffe3a3"/>
    </g>'''


def frame(t, width, height):
    if t < 2:
        # Static wide composition. Background, screen, subject, foreground rail.
        background = "#192c48"
        layers = '''<path d="M0 260H640V360H0Z" fill="#304563"/>
          <path d="M0 360L220 260 M640 360L420 260" stroke="#51627b"/>
          <rect x="410" y="90" width="150" height="104" rx="8" fill="#101b2b"/>
          <rect x="424" y="104" width="122" height="76" fill="#5b9daa"/>'''
        layers += bodybox(170, 270)
        layers += '<path d="M0 320H640" stroke="#101b2b" stroke-width="12"/>'
    elif t < 4:
        # Hard cut to side view; a rigid body proxy crosses behind a pillar.
        background = "#16464c"
        x = 100 + 220 * float(t - 2)
        layers = '''<path d="M0 286H640V360H0Z" fill="#397078"/>
          <path d="M0 288H640" stroke="#91b3b7" stroke-width="3"/>
          <rect x="490" y="66" width="96" height="110" rx="6" fill="#101b2b"/>
          <rect x="500" y="76" width="76" height="90" fill="#5b9daa"/>'''
        layers += bodybox(x, 280, 1.25)
        layers += '''<rect x="292" y="0" width="56" height="318" fill="#0e3038"/>
          <path d="M348 0V318" stroke="#59848a" stroke-width="4"/>'''
    else:
        # Hard cut to screen insert. UI is intentional screen content, held for reading.
        background = "#30233f"
        layers = '''<rect x="64" y="36" width="512" height="288" rx="18" fill="#111925"/>
          <rect x="82" y="54" width="476" height="252" rx="6" fill="#ecf5ee"/>
          <g font-family="DejaVu Sans" fill="#203c38">
            <text x="112" y="110" font-size="22">LOCAL PANEL</text>
            <text x="112" y="176" font-size="40" font-weight="bold">READY</text>
            <text x="112" y="218" font-size="19">03 / 03</text>
          </g>
          <rect x="112" y="252" width="416" height="14" rx="7" fill="#247969"/>'''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 640 360"><rect width="640" height="360" fill="{background}"/>'
            + layers + '</svg>')
