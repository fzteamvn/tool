import { getStore } from '@netlify/blobs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const store = getStore('drag-aim-pro-x-licenses');
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const cleanKey = value => String(value || '').trim().toUpperCase().replace(/\s+/g, '');
const hashKey = value => createHash('sha256').update(cleanKey(value)).digest('hex');
const keyPath = id => `key:${id}`;
const now = () => Date.now();
const isExpired = item => item.expiresAt !== null && item.expiresAt <= now();

function secureEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function makeKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(20);
  let out = 'DAX';
  for (let group = 0; group < 4; group++) {
    let part = '';
    for (let i = 0; i < 4; i++) part += alphabet[bytes[group * 4 + i] % alphabet.length];
    out += `-${part}`;
  }
  return out;
}

async function getLicense(id) {
  return await store.get(keyPath(id), { type: 'json' });
}
async function saveLicense(item) {
  await store.setJSON(keyPath(item.id), item);
}
function publicLicense(item) {
  return {
    id: item.id,
    hint: item.hint,
    status: isExpired(item) && item.status === 'active' ? 'expired' : item.status,
    duration: item.duration,
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
    activatedAt: item.activatedAt,
    deviceBound: Boolean(item.deviceId),
    deviceLabel: item.deviceLabel || null
  };
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const action = String(body.action || '');

  try {
    if (action === 'activate' || action === 'verify') {
      const key = cleanKey(body.key);
      const deviceId = String(body.deviceId || '').slice(0, 100);
      if (key.length < 12 || !deviceId) return json({ ok: false, error: 'missing_key_or_device' }, 400);
      const id = hashKey(key);
      const item = await getLicense(id);
      if (!item) return json({ ok: false, error: 'invalid_key', message: 'Key không tồn tại.' }, 404);
      if (item.status !== 'active') return json({ ok: false, error: item.status === 'revoked' ? 'revoked' : 'inactive', message: 'Key đã bị khóa hoặc không còn hoạt động.' }, 403);
      if (isExpired(item)) {
        item.status = 'expired';
        await saveLicense(item);
        return json({ ok: false, error: 'expired', message: 'Key đã hết hạn.' }, 403);
      }
      if (item.deviceId && item.deviceId !== deviceId) {
        return json({ ok: false, error: 'device_limit', message: 'Key đã được kích hoạt trên thiết bị khác. Hãy liên hệ Admin để reset thiết bị.' }, 403);
      }
      if (!item.deviceId) {
        item.deviceId = deviceId;
        item.deviceLabel = String(body.deviceLabel || 'Browser device').slice(0, 80);
        item.activatedAt = new Date().toISOString();
        await saveLicense(item);
      }
      return json({ ok: true, status: 'active', expiresAt: item.expiresAt, activatedAt: item.activatedAt, hint: item.hint, message: 'Xác thực thành công.' });
    }

    if (action.startsWith('admin_')) {
      const expected = process.env.ADMIN_PASSWORD;
      if (!expected) return json({ ok: false, error: 'admin_not_configured', message: 'Chưa cấu hình ADMIN_PASSWORD trên Netlify.' }, 503);
      if (!secureEqual(req.headers.get('x-admin-password'), expected)) return json({ ok: false, error: 'unauthorized', message: 'Mật khẩu Admin không đúng.' }, 401);

      if (action === 'admin_create') {
        const duration = String(body.duration || '30');
        if (!['7', '30', 'lifetime'].includes(duration)) return json({ ok: false, error: 'invalid_duration' }, 400);
        let key = makeKey();
        let id = hashKey(key);
        while (await getLicense(id)) { key = makeKey(); id = hashKey(key); }
        const createdAt = new Date().toISOString();
        const expiresAt = duration === 'lifetime' ? null : now() + Number(duration) * 86400000;
        const item = {
          id, hint: key.slice(-4), status: 'active', duration,
          createdAt, expiresAt, activatedAt: null, deviceId: null, deviceLabel: null
        };
        await saveLicense(item);
        return json({ ok: true, key, license: publicLicense(item) });
      }

      if (action === 'admin_list') {
        const listed = await store.list({ prefix: 'key:' });
        const items = await Promise.all((listed.blobs || []).map(async entry => getLicense(entry.key.slice(4))));
        return json({ ok: true, licenses: items.filter(Boolean).map(publicLicense).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
      }

      const id = String(body.id || '');
      if (!/^[a-f0-9]{64}$/.test(id)) return json({ ok: false, error: 'invalid_license_id' }, 400);
      const item = await getLicense(id);
      if (!item) return json({ ok: false, error: 'not_found' }, 404);

      if (action === 'admin_revoke') {
        item.status = 'revoked';
        await saveLicense(item);
        return json({ ok: true, license: publicLicense(item) });
      }
      if (action === 'admin_reset_device') {
        item.deviceId = null;
        item.deviceLabel = null;
        item.activatedAt = null;
        await saveLicense(item);
        return json({ ok: true, license: publicLicense(item) });
      }
      if (action === 'admin_renew') {
        const duration = String(body.duration || '30');
        if (!['7', '30', 'lifetime'].includes(duration)) return json({ ok: false, error: 'invalid_duration' }, 400);
        item.status = 'active';
        item.duration = duration;
        item.expiresAt = duration === 'lifetime' ? null : Math.max(now(), item.expiresAt || 0) + Number(duration) * 86400000;
        await saveLicense(item);
        return json({ ok: true, license: publicLicense(item) });
      }
      return json({ ok: false, error: 'unknown_action' }, 400);
    }

    return json({ ok: false, error: 'unknown_action' }, 400);
  } catch (error) {
    console.error('license function error', error);
    return json({ ok: false, error: 'server_error', message: 'Server đang bận. Vui lòng thử lại.' }, 500);
  }
};
