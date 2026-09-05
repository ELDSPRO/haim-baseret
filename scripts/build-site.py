"""Build the static game from an explicit runtime allowlist, without saves or archives."""
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'dist'
FILES = (
    'film-network.js', 'film-workload.js', 'film-advice.js', 'encounters.css', 'assets/industry-encounters.png', 'index.html', 'film-industry.js', 'film-life.js', 'game-engine.js', 'game-ui.js',
    'game.css', 'career.css', 'life.css', 'chapters.css', 'film-stories.js', 'film-crowdfunding.js', 'film-local.js', 'film-events.js', 'assets/amir-portrait.png', 'assets/city-map.svg', 'assets/city-map.png',
    'assets/city-athens.png', 'assets/city-berlin.png', 'assets/city-london.png', 'assets/city-los-angeles.png',
    'assets/characters.png', 'assets/playable-characters.png',
)

for name in FILES:
    source = ROOT / name
    if not source.is_file():
        raise SystemExit(f'Missing runtime file: {name}')
    if source.suffix == '.js':
        subprocess.run(['node', '--check', str(source)], check=True)

OUTPUT.mkdir(exist_ok=True)
# The generated directory has no editable source; discard stale generated assets.
for child in OUTPUT.iterdir():
    if child.is_dir() and not child.is_symlink():
        shutil.rmtree(child)
    else:
        child.unlink()
for name in FILES:
    target = OUTPUT / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / name, target)
print(f'Built {len(FILES)} runtime files in dist/')
