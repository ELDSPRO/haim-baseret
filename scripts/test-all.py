"""Run existing engine checks in fixture dependency order on any supported OS."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent
SUITES = (
    'game', 'career', 'lifetime', 'chapters', 'expansion', 'industry',
    'setbacks', 'locations', 'life', 'local', 'festival-parallel',
    'events', 'advice', 'network', 'workload',
)

for suite in SUITES:
    name = f'test-film-{suite}.js'
    print(f'Running {name}', flush=True)
    subprocess.run(['node', name], cwd=ROOT, check=True)
print(f'All {len(SUITES)} test suites passed.', flush=True)
