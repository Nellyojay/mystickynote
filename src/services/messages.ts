import { supabase } from '../lib/supabase'
import type { StickyNoteRecord } from '../types/supabase'
import { isValidStickyCode, normalizeStickyCode } from './fns'
import { getStickyCode } from './getToken'

export const STICKY_NOTE_TABLE_NAME = 'sticky_note'
export const LOGGED_IN = 'logged_in_sticky_note'
export const STICKY_NOTE_TTL_MS = 3 * 60 * 60 * 1000
export const STICKY_NOTE_STATUS_EXPIRED = 'EXPIRED'
export const STICKY_NOTE_STATUS_ACTIVE = 'ACTIVE'
const STICKY_NOTE_SELECT = 'id, sticky_code, status, created_at, opened_at, expires_at, message'

const makeStickyNoteOpenedAtKey = (stickyCode: string) => `sticky_note_opened_at_${normalizeStickyCode(stickyCode)}`

export function getStickyNoteOpenedAt(stickyCode: string): number | null {
  const value = localStorage.getItem(makeStickyNoteOpenedAtKey(stickyCode))
  if (!value) {
    return null
  }

  const timestamp = Number(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function setStickyNoteOpenedAt(stickyCode: string, timestamp = Date.now()) {
  localStorage.setItem(makeStickyNoteOpenedAtKey(stickyCode), String(timestamp))
  return timestamp
}

export function clearStickyNoteOpenedAt(stickyCode: string) {
  localStorage.removeItem(makeStickyNoteOpenedAtKey(stickyCode))
}

export function parseStickyNoteTimestamp(value?: string | null): number | null {
  if (!value) {
    return null
  }

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

export function getStickyNoteExpiryTimestamp(note: StickyNoteRecord | null): number | null {
  if (!note) {
    return null
  }

  const explicitExpiry = parseStickyNoteTimestamp(note.expires_at)
  if (explicitExpiry !== null) {
    return explicitExpiry
  }

  const baseTime = parseStickyNoteTimestamp(note.opened_at)
  if (baseTime === null) {
    return null
  }

  return baseTime + STICKY_NOTE_TTL_MS
}

export function isStickyNoteExpiredRecord(note: StickyNoteRecord | null): boolean {
  const expiry = getStickyNoteExpiryTimestamp(note)
  return expiry !== null && Date.now() >= expiry
}

export function getStickyNoteTimeLeft(note: StickyNoteRecord | null): number {
  const expiry = getStickyNoteExpiryTimestamp(note)
  if (expiry === null) {
    return STICKY_NOTE_TTL_MS
  }

  return Math.max(0, expiry - Date.now())
}

/** Checks whether a sticky code exists and returns its note record. */
export async function stickyCodeExists(stickyCode: string): Promise<[boolean, StickyNoteRecord | null]> {
  const code = normalizeStickyCode(stickyCode || getStickyCode())

  if (!isValidStickyCode(code)) {
    return [false, null]
  }

  const { data, error } = await supabase
    .from(STICKY_NOTE_TABLE_NAME)
    .select(STICKY_NOTE_SELECT)
    .eq('sticky_code', code)
    .limit(1)

  if (error && error.code !== 'PGRST116') {
    console.log('Failed to check sticky code existence', error)
    throw error
  }

  return [Array.isArray(data) && data.length > 0, data?.[0] || null]
}

export async function getStickyNoteByCode(stickyCode: string): Promise<StickyNoteRecord | null> {
  const code = normalizeStickyCode(stickyCode)

  if (!isValidStickyCode(code)) {
    return null
  }

  const { data, error } = await supabase
    .from(STICKY_NOTE_TABLE_NAME)
    .select(STICKY_NOTE_SELECT)
    .eq('sticky_code', code)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to load sticky note record:', error)
    throw error
  }

  return (data as StickyNoteRecord | null) ?? null
}

export async function openStickyNoteWindow(stickyNoteId: string, savedMessage: string | null): Promise<StickyNoteRecord | null> {
  if (!stickyNoteId) {
    return null
  }

  const { data, error } = await supabase
    .from(STICKY_NOTE_TABLE_NAME)
    .select(STICKY_NOTE_SELECT)
    .eq('id', stickyNoteId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  if (!data) {
    return null
  }

  if (data.status === STICKY_NOTE_STATUS_EXPIRED) {
    return data as StickyNoteRecord
  }

  const shouldResetExpiry = !data.opened_at || !data.expires_at || isStickyNoteExpiredRecord(data)
  if (shouldResetExpiry) {
    const now = Date.now()
    const nextExpiresAt = new Date(now + STICKY_NOTE_TTL_MS).toISOString()

    const { data: updated, error: updateError } = await supabase
      .from(STICKY_NOTE_TABLE_NAME)
      .update({
        opened_at: savedMessage ? new Date(now).toISOString() : null,
        expires_at: savedMessage ? nextExpiresAt : null,
        status: savedMessage ? STICKY_NOTE_STATUS_ACTIVE : null,
      })
      .eq('id', stickyNoteId)
      .select(STICKY_NOTE_SELECT)
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    return (updated as StickyNoteRecord | null) ?? null
  }

  return data as StickyNoteRecord
}

/** Fetches the currently saved message for a sticky note. */
export async function fetchMessage(stickyNoteId: string) {
  if (!stickyNoteId) {
    return null
  }

  const { data, error } = await supabase
    .from(STICKY_NOTE_TABLE_NAME)
    .select('message')
    .eq('id', stickyNoteId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to load sticky message:', error)
    throw error
  }

  return data && typeof data.message === 'string' ? { message: data.message } : null
}

/** Saves a message against a sticky note ID by updating the message column on the note. */
export async function saveMessage(message: string, stickyNoteId: string) {
  if (!message || !stickyNoteId) {
    throw new Error('No active sticky note found.')
  }

  const { data, error } = await supabase
    .from(STICKY_NOTE_TABLE_NAME)
    .update({ message })
    .eq('id', stickyNoteId)
    .select('message')
    .single()

  if (error) {
    throw error
  }

  return data as { message: string }
}

/** Marks a sticky note as expired without deleting its history. */
export async function markStickyNoteExpired(stickyNoteId: string) {
  if (!stickyNoteId) {
    return false
  }

  const { error } = await supabase
    .from(STICKY_NOTE_TABLE_NAME)
    .update({ status: STICKY_NOTE_STATUS_EXPIRED })
    .eq('id', stickyNoteId)

  if (error) {
    console.error('Failed to mark sticky note as expired:', error)
    throw error
  }

  return true
}

/** Resolves a sticky code to its database note ID. */
export async function resolveStickyNoteId(stickyCode: string): Promise<string | null> {
  const code = normalizeStickyCode(stickyCode)

  if (!isValidStickyCode(code)) {
    return null
  }

  const { data, error } = await supabase
    .from(STICKY_NOTE_TABLE_NAME)
    .select('id')
    .eq('sticky_code', code)
    .single()

  if (error) {
    console.error('Failed to resolve sticky note ID:', error)
    return null
  }

  return data?.id || null
}

/** Creates a sticky note and stores the active note session locally. */
export async function createStickyNote(stickyCode: string): Promise<StickyNoteRecord | null> {
  const code = normalizeStickyCode(stickyCode)

  if (!isValidStickyCode(code)) {
    return null
  }

  const { data, error } = await supabase
    .from(STICKY_NOTE_TABLE_NAME)
    .insert({
      sticky_code: code,
    })
    .select(STICKY_NOTE_SELECT)
    .maybeSingle()

  if (error || !data) {
    console.log('Failed to create this sticky note:', error)
    return null
  }

  return data as StickyNoteRecord
}
