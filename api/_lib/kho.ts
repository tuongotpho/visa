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

export async function docKy(id: string) {
  return idHopLe(id) ? docJson<Ky>(`ky/${id}.json`) : null
}

// ---------- Kết nối AI (MCP): phiên của từng máy + nhật ký ghi ----------
//   mcp/phien/<id>.json     một máy AI đã được cho phép (xoá = thu hồi)
//   mcp/nhat-ky/<giờ>-<id>  mỗi lần AI GHI dữ liệu (chỉ thêm, không sửa)

export interface PhienMcp {
  id: string
  email: string
  tenMay: string
  ungDung: string
  noiNhan: string
  taoLuc: string
}
export interface DongNhatKy {
  luc: string
  phien: string
  tenMay: string
  congCu: string
  moTa: string
}

const ID_PHIEN = /^[a-f0-9]{24}$/

async function dsJson<T>(prefix: string, toiDa = 500): Promise<T[]> {
  const ds: string[] = []
  let cursor: string | undefined
  do {
    const r = await list({ prefix, cursor })
    ds.push(...r.blobs.map((b) => b.pathname))
    cursor = r.hasMore && ds.length < toiDa ? r.cursor : undefined
  } while (cursor)
  return (await Promise.all(ds.slice(-toiDa).map((p) => docJson<T>(p)))).filter((x): x is Awaited<T> & T => !!x)
}

export async function taoPhien(p: PhienMcp) {
  await put(`mcp/phien/${p.id}.json`, JSON.stringify(p), { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json' })
}
export const docPhien = (id: string) => (ID_PHIEN.test(id) ? docJson<PhienMcp>(`mcp/phien/${id}.json`) : Promise.resolve(null))
export const dsPhien = () => dsJson<PhienMcp>('mcp/phien/')
export async function xoaPhien(id: string) {
  if (ID_PHIEN.test(id)) await del(`mcp/phien/${id}.json`)
}

export async function ghiNhatKy(d: DongNhatKy) {
  await put(`mcp/nhat-ky/${d.luc.replace(/[:.]/g, '-')}-${d.phien}.json`, JSON.stringify(d), {
    access: 'private', addRandomSuffix: true, contentType: 'application/json',
  })
}
export const dsNhatKy = async () => (await dsJson<DongNhatKy>('mcp/nhat-ky/', 200)).sort((a, b) => b.luc.localeCompare(a.luc))
