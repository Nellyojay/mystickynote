export type StickerMessage = {
  id?: number
  message: string
  time_past?: string
  sticky_noteId?: string
}

export type StickyNoteRecord = {
  id: string
  sticky_code?: string
  status?: string | null
  created_at?: string | null
  opened_at?: string | null
  expires_at?: string | null
}
