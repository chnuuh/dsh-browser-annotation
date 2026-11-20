import { createRuntime, visibleGuest, activeSession } from './runtime.js';

export function plugin(React) {
  return {
    inject: ['slots', 'sessions'],
    apply(ctx) {
      let runtime;
      ctx.effect(() => {
        runtime = createRuntime({
          current: () => visibleGuest(document),
          session: () => activeSession(ctx.sessions.list),
          owner: crypto.randomUUID()
        });
        return () => runtime.dispose();
      }, 'browser-annotation.runtime');

      function AnnotationDraftBinding({ sessionId, inputActions }) {
        React.useEffect(() => runtime.bind(sessionId, inputActions), [sessionId, inputActions]);
        return null;
      }

      ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
        name: 'conversation.input.right', id: 'dsh-browser-annotation', order: 95
      }, AnnotationDraftBinding));
    }
  };
}
