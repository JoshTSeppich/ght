#!/usr/bin/env python3
"""Import selected original frames into the local artifact store, never into Git.

Input spec: {id,task,revision,title,provenance,approval,owner_session,tracks:[
  {character,action,direction,directory,glob,duration_ms} ... ]}
Use a local untracked spec; absolute source paths are not written into the review.
"""
import argparse
import json
from pathlib import Path
from core import Hub


def main():
    p = argparse.ArgumentParser()
    p.add_argument('spec')
    p.add_argument('--data', required=True)
    p.add_argument('--amp-home', default=str(Path.home() / '.amp-bridge'))
    args = p.parse_args()
    spec = json.loads(Path(args.spec).read_text())
    hub = Hub(args.data, args.amp_home)
    tracks = []
    for t in spec['tracks']:
        directory = Path(t['directory']).resolve()
        files = sorted(directory.glob(t.get('glob', '*_f[0-9]*.png')))
        if not files or len(files) > 240:
            raise ValueError('Import needs 1 to 240 explicit frames')
        frames = [dict(hub.put_artifact(f.name, f.read_bytes()), duration_ms=t.get('duration_ms', 125)) for f in files]
        tracks.append({k: v for k, v in dict(t, frames=frames).items() if k not in ('directory', 'glob', 'duration_ms')})
    review = hub.review(dict(spec, tracks=tracks))
    print(json.dumps({'review': review['id'], 'tracks': len(tracks), 'frames': sum(len(t['frames']) for t in tracks), 'scope': 'local-only'}))


if __name__ == '__main__':
    main()
