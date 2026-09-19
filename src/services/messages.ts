import { supabase } from '../lib/supabase'
import type { StickerMessage } from '../types/supabase'
import { isValidStickyCode, normalizeStickyCode } from './fns'
import { getStickyCode } from './getToken'

export const STICKY_NOTE_TABLE_NAME = 'sticky_note'
export const STICKY_NOTE_MESSAGE_TABLE = 'sticky_message'
export const LOGGED_IN = 'logged_in_sticky_note'

/** Checks whether a sticky code exists and returns its note record. */
export async function stickyCodeExists(stickyCode: string): Promise<[boolean, { id: string } | null]> {
  const code = normalizeStickyCode(stickyCode || getStickyCode())

  if (!isValidStickyCode(code)) {
    return [false, null]
  }

  const { data, error } = await supabase
    .from(STICKY_NOTE_TABLE_NAME)
    .select('id')
    .eq('sticky_code', code)
    .limit(1)

  if (error && error.code !== 'PGRST116') {
    console.log('Failed to check sticky code existence', error)
    throw error
  }

  return [Array.isArray(data) && data.length > 0, data?.[0] || null]
}

/** Retrieves the newest message saved for a sticky note. */
export async function getLatestMessage(stickyNoteId: string) {
  const noteId = stickyNoteId

  if (!noteId) {
    return null
  }

  const { data, error } = await supabase
    .from(STICKY_NOTE_MESSAGE_TABLE)
    .select('message, time_past, sticky_noteId')
    .eq('sticky_noteId', noteId)
    .order('time_past', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to load latest:', error)
    throw error
  }

  return data as StickerMessage | null
}

/** Saves a message against a sticky note ID. */
export async function saveMessage(message: string, stickyNoteId: string) {

  if (!message || !stickyNoteId) {
    throw new Error('No active sticky note found.')
  }

  const { data, error } = await supabase
    .from(STICKY_NOTE_MESSAGE_TABLE)
    .insert({
      message,
      sticky_noteId: stickyNoteId,
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as StickerMessage
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
export async function createStickyNote(stickyCode: string) {
  const code = normalizeStickyCode(stickyCode)

  if (!isValidStickyCode(code)) {
    return false
  }

  const { data, error } = await supabase
    .from(STICKY_NOTE_TABLE_NAME)
    .insert({ sticky_code: code })
    .select('id')
    .single()

  if (error) {
    return false;
  }

  localStorage.setItem(LOGGED_IN, `${data.id}_${code}`);

  return Boolean(data);
}
