import { videoProject } from './video-project.js';

export function videoRetrieval(t) {
  const f = videoProject(t);
  const captured = f.cli('video-task-inputs.mjs', ['capture', f.tasks, '1',
    'dreamina', 'model', '16:9', '1080p']);
  if (captured.status !== 0) throw new Error(captured.stderr);
  Object.assign(f.task, { submit_id: 'job-1', status: 'submitted',
    submission: JSON.parse(captured.stdout),
    initial_authorization: { decision: 'Submit shot 1', episode: 'ep01', shot: 1, constraints: [] } });
  f.save();
  return f;
}
