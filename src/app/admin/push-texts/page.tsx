'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AdminPage,
  PageHeader,
  SectionTitle,
  AdminCard,
  AdminButton,
  inputStyle,
  labelStyle,
} from '@/components/admin/ui';
import { AlertTriangle, Check, Clock, MessageSquareText, RotateCcw, Smartphone, Undo2 } from 'lucide-react';
import {
  BODY_MAX,
  TITLE_MAX,
  previewPush,
  validateTemplate,
  type PushTemplateGroup,
  type PushTemplateKey,
  type PushTemplateVar,
  type PushText,
} from '@/lib/notifications/templates';

// Админка: тексты пушей по сценариям (п.11 «Середина сентября»). Сценарии —
// когда уходит пуш — заданы в коде; текст пишет админ. Переменные в {скобках}.

interface TemplateItem {
  key: PushTemplateKey;
  group: PushTemplateGroup;
  label: string;
  when: string;
  vars: PushTemplateVar[];
  defaults: PushText;
  current: PushText;
  overridden: boolean;
}

interface Listing {
  groups: Record<PushTemplateGroup, string>;
  templates: TemplateItem[];
}

const GROUP_ORDER: PushTemplateGroup[] = ['engagement', 'cycle', 'tasks', 'subscription'];

export default function PushTextsAdminPage() {
  const [data, setData] = useState<Listing | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/push-templates');
        if (!res.ok) throw new Error();
        setData(await res.json());
      } catch {
        setLoadError('Не удалось загрузить тексты');
      }
    })();
  }, []);

  return (
    <AdminPage width="narrow">
      <PageHeader title="Тексты уведомлений" icon={MessageSquareText} backHref="/admin" />

      <p style={{ color: 'var(--color-muted)', fontSize: 14, lineHeight: 1.5, margin: '0 0 24px' }}>
        Когда уходит каждый пуш, задано в приложении, а текст пишете вы. Переменные в фигурных скобках
        подставляются сами: <b>{'{name}'}</b> — имя игрока. Изменения действуют сразу. Время вечерних пушей
        и напоминаний — в разделе «Время уведомлений».
      </p>

      {loadError && (
        <AdminCard tone="danger">
          <span style={{ fontSize: 14, fontWeight: 700 }}>{loadError}</span>
        </AdminCard>
      )}

      {!data && !loadError && (
        <div className="flex flex-col" style={{ gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                height: 220,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--border-hairline)',
              }}
            />
          ))}
        </div>
      )}

      {data && (
        <div className="flex flex-col" style={{ gap: 32 }}>
          {GROUP_ORDER.map((group) => {
            const items = data.templates.filter((t) => t.group === group);
            if (items.length === 0) return null;
            return (
              <section key={group}>
                <SectionTitle>{data.groups[group]}</SectionTitle>
                <div className="flex flex-col" style={{ gap: 16 }}>
                  {items.map((t) => (
                    <TemplateCard key={t.key} item={t} onSaved={setData} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AdminPage>
  );
}

function TemplateCard({ item, onSaved }: { item: TemplateItem; onSaved: (d: Listing) => void }) {
  const [title, setTitle] = useState(item.current.title);
  const [body, setBody] = useState(item.current.body);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  // Куда вставлять переменную по тапу на чип — в поле, где был курсор
  const [focused, setFocused] = useState<'title' | 'body'>('body');

  // После сохранения/сброса сервер присылает свежие тексты
  useEffect(() => {
    setTitle(item.current.title);
    setBody(item.current.body);
  }, [item.current.title, item.current.body]);

  // Сервер обрезает пробелы по краям — правка из одних пробелов не «правка»
  const dirty = title.trim() !== item.current.title || body.trim() !== item.current.body;
  const error = useMemo(() => validateTemplate(item.key, { title, body }), [item.key, title, body]);
  const preview = useMemo(
    () => (error ? null : previewPush(item.key, { title, body })),
    [error, item.key, title, body],
  );

  const send = async (payload: Record<string, unknown>, okText: string) => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/push-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: item.key, ...payload }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: 'err', text: d?.error || 'Ошибка сохранения' });
        return;
      }
      onSaved(d);
      setMsg({ type: 'ok', text: okText });
    } catch {
      setMsg({ type: 'err', text: 'Сетевая ошибка' });
    } finally {
      setSaving(false);
    }
  };

  const insertVar = (key: string) => {
    const add = (v: string) => `${v}${v.endsWith(' ') || !v ? '' : ' '}{${key}}`;
    if (focused === 'title') setTitle(add);
    else setBody(add);
  };

  return (
    <AdminCard>
      <div className="flex items-start justify-between gap-3" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{item.label}</div>
        {item.overridden && (
          <span
            style={{
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-brand)',
              border: '1px solid var(--border-lime)',
              borderRadius: 999,
              padding: '2px 8px',
            }}
          >
            Изменён
          </span>
        )}
      </div>
      <div className="flex items-start gap-2" style={{ color: 'var(--color-muted)', fontSize: 13, lineHeight: 1.45, marginBottom: 16 }}>
        <Clock size={16} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
        <span>{item.when}</span>
      </div>

      <label style={labelStyle} htmlFor={`${item.key}-title`}>
        Заголовок · {Array.from(title).length}/{TITLE_MAX}
      </label>
      <input
        id={`${item.key}-title`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={() => setFocused('title')}
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      <label style={labelStyle} htmlFor={`${item.key}-body`}>
        Текст · {Array.from(body).length}/{BODY_MAX}
      </label>
      <textarea
        id={`${item.key}-body`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => setFocused('body')}
        rows={3}
        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }}
      />

      <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
        {item.vars.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => insertVar(v.key)}
            title={`Вставить в ${focused === 'title' ? 'заголовок' : 'текст'}: ${v.hint}`}
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-hairline)',
              color: 'var(--color-ink)',
            }}
          >
            <b>{`{${v.key}}`}</b> <span style={{ color: 'var(--color-muted)' }}>— {v.hint}</span>
          </button>
        ))}
      </div>

      {/* Предпросмотр — как в шторке телефона, на примерах переменных */}
      <div
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--color-night)',
          border: '1px solid var(--border-hairline)',
        }}
      >
        <div className="flex items-center gap-2" style={{ color: 'var(--color-muted)', fontSize: 12, marginBottom: 6 }}>
          <Smartphone size={16} aria-hidden />
          Так увидит игрок
        </div>
        {preview ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{preview.title}</div>
            <div style={{ fontSize: 14, lineHeight: 1.4, marginTop: 2 }}>{preview.body}</div>
          </>
        ) : (
          <div className="flex items-center gap-2" style={{ fontSize: 13, color: 'var(--color-danger)' }}>
            <AlertTriangle size={16} aria-hidden />
            {error}
          </div>
        )}
      </div>

      {msg && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: 12,
            fontSize: 13,
            fontWeight: 700,
            color: msg.type === 'ok' ? 'var(--color-brand)' : 'var(--color-danger)',
          }}
        >
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap gap-3" style={{ marginTop: 16 }}>
        <AdminButton
          type="button"
          size="sm"
          icon={Check}
          disabled={saving || !dirty || !!error}
          onClick={() => send({ title: title.trim(), body: body.trim() }, 'Сохранено')}
        >
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </AdminButton>
        {dirty && (
          <AdminButton
            type="button"
            size="sm"
            tone="secondary"
            icon={Undo2}
            disabled={saving}
            onClick={() => {
              setTitle(item.current.title);
              setBody(item.current.body);
              setMsg(null);
            }}
          >
            Отменить правку
          </AdminButton>
        )}
        {item.overridden && (
          <AdminButton
            type="button"
            size="sm"
            tone="secondary"
            icon={RotateCcw}
            disabled={saving}
            onClick={() => {
              if (window.confirm('Вернуть стандартный текст?')) send({ reset: true }, 'Вернули стандартный текст');
            }}
          >
            Стандартный текст
          </AdminButton>
        )}
      </div>
    </AdminCard>
  );
}
