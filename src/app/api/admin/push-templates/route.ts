import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';
import { logger } from '@/lib/logger';
import {
  PUSH_GROUP_LABELS,
  PUSH_TEMPLATES,
  getTemplateDef,
  validateTemplate,
  type PushTemplates,
} from '@/lib/notifications/templates';
import { getPushTemplates, savePushTemplate } from '@/lib/notifications/templates-server';

// Тексты пушей по сценариям (п.11 «Середина сентября»). Только админ.
// GET → все сценарии с текущим и стандартным текстом.
// PATCH { key, title, body } — сохранить; { key, reset: true } — вернуть стандартный.
export const dynamic = 'force-dynamic';

function listing(current: PushTemplates) {
  return {
    groups: PUSH_GROUP_LABELS,
    templates: PUSH_TEMPLATES.map((t) => ({
      key: t.key,
      group: t.group,
      label: t.label,
      when: t.when,
      vars: t.vars,
      defaults: t.defaults,
      current: current[t.key],
      overridden: current[t.key].title !== t.defaults.title || current[t.key].body !== t.defaults.body,
    })),
  };
}

export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    return NextResponse.json(listing(await getPushTemplates()));
  } catch (error) {
    logger.error('admin/push-templates GET failed', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const def = getTemplateDef(String(body?.key ?? ''));
    if (!def) return NextResponse.json({ error: 'Неизвестный сценарий' }, { status: 400 });

    if (body.reset === true) {
      return NextResponse.json(listing(await savePushTemplate(def.key, null)));
    }
    const error = validateTemplate(def.key, { title: body.title, body: body.body });
    if (error) return NextResponse.json({ error }, { status: 400 });
    const saved = await savePushTemplate(def.key, { title: String(body.title).trim(), body: String(body.body).trim() });
    return NextResponse.json(listing(saved));
  } catch (error) {
    logger.error('admin/push-templates PATCH failed', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
