import { groupedVideo } from './grouped-video.js';

export function videoRetrieval(t) {
  const f = groupedVideo(t);
  const captured = f.cli('video-task-inputs.mjs', ['capture', f.tasks, 'task01',
    'dreamina', 'model', '16:9', '1080p']);
  if (captured.status !== 0) throw new Error(captured.stderr);
  Object.assign(f.task, { submit_id: 'job-1', status: 'submitted',
    submission: JSON.parse(captured.stdout),
    initial_authorization: { decision: 'Submit task01', episode: 'ep01', task_id: 'task01', shots: [1, 2, 3], constraints: [] } });
  f.save();
  return f;
}
