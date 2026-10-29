// Kho dữ liệu trên Vercel Blob, chế độ RIÊNG TƯ (chỉ máy chủ có BLOB_READ_WRITE_TOKEN mới đọc được).
//   ky/<id>.json  — một kỳ sao kê đã đọc + đã đối chiếu
//   pdf/<id>.pdf  — file sao kê gốc
import { del, get, list, put } from '@vercel/blob'
import type { Ky } from '../../shared/kieu.js'

const ID = /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/
export const idHopLe = (id: string) => ID.test(id)

async function docJson<T>(pathname: string): Promise<T | null> {
  const r = await get(pathname, { access: 'private', useCache: false })
  if (!r || r.statusCode !== 200) return null
  return JSON.parse(await new Response(r.stream).text()) as T
}

export async function dsKy(): Promise<Ky[]> {
  const ds: string[] = []
  let cursor: string | undefined
  do {
    const r = await list({ prefix: 'ky/', cursor })
    ds.push(...r.blobs.map((b) => b.pathname))
    cursor = r.hasMore ? r.cursor : undefined
  } while (cursor)
  const ky = await Promise.all(ds.map((p) => docJson<Ky>(p)))
  return ky.filter((k): k is Ky => !!k).sort((a, b) => a.tu.localeCompare(b.tu))
}

export async function luuKy(ky: Ky) {
  await put(`ky/${ky.id}.json`, JSON.stringify(ky), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json',
  })
}

export async function luuPdf(id: string, pdf: ArrayBuffer) {
  await put(`pdf/${id}.pdf`, Buffer.from(pdf), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/pdf',
  })
}

export async function docPdf(id: string) {
  const r = await get(`pdf/${id}.pdf`, { access: 'private', useCache: false })
  return r && r.statusCode === 200 ? r.stream : null
}

export async function xoaKy(id: string) {
  await del([`ky/${id}.json`, `pdf/${id}.pdf`]).catch(() => del(`ky/${id}.json`))
}
