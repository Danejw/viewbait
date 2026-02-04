/**
 * Remotion entry point. Register the root so Remotion Studio and renderer can find compositions.
 */
import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);
