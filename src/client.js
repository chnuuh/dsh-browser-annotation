import { createRuntime, visibleGuest, activeSession } from './runtime.js';
// React is supplied by the DSH client module loader, not bundled here.
export function plugin(React) {
  const copy = {
    zh: {
      button: '网页标注', pause: '暂停标注（会清除未提交的标注）', resume: '启用网页标注',
      ready: '在右侧网页元素上右键，选择 Quick annotation 或 Annotation。',
      inserted: '标注已加入当前草稿，请检查后发送。',
      'no-composer': '等待当前对话输入框。',
      'no-browser': '请打开一个 DSH Desktop 内嵌网页。多个可见网页时暂不接入。',
      legacy: '检测到旧 Annotation 补丁，请先按迁移说明移除并重启 DSH。',
      conflict: '这个网页已由另一个标注实例接管。',
      'other-session': '标注属于之前的对话，请切回原对话完成或退出标注。',
      busy: '输入框暂不可写，标注会保留并稍后重试。',
      error: '网页标注暂不可用，请等待加载完成或重新打开网页。', paused: '网页标注已暂停。'
    },
    en: {
      button: 'Annotate', pause: 'Pause annotations (discards unsent notes)', resume: 'Enable annotations',
      ready: 'Right-click a webpage element for Quick annotation or Annotation.',
      inserted: 'Added to the current draft. Review it before sending.',
      'no-composer': 'Waiting for a conversation composer.',
      'no-browser': 'Open one DSH Desktop embedded webpage. Multiple visible pages are not selected automatically.',
      legacy: 'Legacy annotation patch detected. Follow the migration guide and restart DSH.',
      conflict: 'Another annotation instance owns this page.',
      'other-session': 'Return to the original conversation to complete or cancel these annotations.',
      busy: 'The composer is busy. Annotations remain queued for retry.',
      error: 'Annotations are unavailable. Wait for the page to load or reopen it.', paused: 'Annotations paused.'
    }
  };
  return {
    inject: ['slots', 'sessions', 'locale'],
    apply(ctx) {
      const listeners = new Set(); let status = 'no-browser', enabled = true, runtime;
      const notify = () => { for (const listener of listeners) listener(); };
      ctx.effect(() => ctx.locale.register('browserAnnotation', copy), 'browser-annotation.locale');
      ctx.effect(() => {
        runtime = createRuntime({ current: () => visibleGuest(document),
          session: () => activeSession(ctx.sessions.list), owner: crypto.randomUUID(),
          report: value => { status = value; notify(); } });
        return () => runtime.dispose();
      }, 'browser-annotation.runtime');
      function AnnotationControl({ sessionId, inputActions, t }) {
        React.useEffect(() => runtime.bind(sessionId, inputActions), [sessionId, inputActions]);
        const value = React.useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => `${enabled}:${status}`);
        return React.createElement('button', {
          type: 'button', 'data-browser-annotation-control': '', 'data-state': value,
          'aria-label': t('button'), 'aria-pressed': enabled, title: `${t(status)} ${t(enabled ? 'pause' : 'resume')}`,
          onClick: () => { enabled = !enabled; notify(); void runtime.setEnabled(enabled); },
          style: { font: 'inherit', fontSize: 12, color: 'var(--dsw-alias-label-secondary)',
            background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l2)',
            borderRadius: 6, padding: '4px 7px', cursor: 'pointer' }
        }, t('button'));
      }
      ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
        name: 'conversation.input.right', id: 'dsh-browser-annotation', order: 95, locale: 'browserAnnotation'
      }, AnnotationControl));
    }
  };
}
