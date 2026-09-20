import { useEffect, useState } from 'react'
import { generateCityToken, getStickyCode, STICKY_CODE_KEY } from './services/getToken'
import { isValidStickyCode, normalizeStickyCode } from './services/fns'
import {
  clearStickyNoteOpenedAt,
  createStickyNote,
  getLatestMessage,
  getStickyNoteByCode,
  getStickyNoteExpiryTimestamp,
  isStickyNoteExpiredRecord,
  LOGGED_IN,
  markStickyNoteExpired,
  openStickyNoteWindow,
  saveMessage,
  STICKY_NOTE_TTL_MS,
  STICKY_NOTE_STATUS_EXPIRED,
  stickyCodeExists,
} from './services/messages'
import Loader from './pages/components/loader'
import './styles/sticker-card.css'

const LOADER_DURATION_MS = 3000

/** Keeps the loader visible for at least the configured duration. */
const waitForLoader = async (startedAt: number) => {
  const remainingTime = LOADER_DURATION_MS - (Date.now() - startedAt)
  if (remainingTime > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingTime))
  }
}

/** Converts milliseconds into an hours, minutes, and seconds countdown. */
const formatCountdown = (msLeft: number) => {
  const totalSeconds = Math.max(0, Math.ceil(msLeft / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** Renders the sticky note application and manages its note lifecycle. */
function App() {
  const [inputValue, setInputValue] = useState('')
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(formatCountdown(STICKY_NOTE_TTL_MS))
  const [countdownActive, setCountdownActive] = useState(false)
  const [stickyCode, setStickyCode] = useState('')
  const [stickyCodeInput, setStickyCodeInput] = useState(() => getStickyCode())
  const [stickyCodeError, setStickyCodeError] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  const loadLatestNoteMessage = async (noteId: string | null) => {
    if (!noteId) {
      setSavedMessage(null)
      return
    }

    const latestMessage = await getLatestMessage(noteId)
    if (latestMessage) {
      setSavedMessage(latestMessage.message)
      return
    }

    setSavedMessage(null)
  }

  useEffect(() => {
    if (!loggedIn || !stickyCode) {
      setCountdownActive(false)
      return
    }

    let timerId: number | undefined

    const updateCountdown = async () => {
      const stickyNote = await getStickyNoteByCode(stickyCode)
      const expiry = getStickyNoteExpiryTimestamp(stickyNote)

      if (expiry === null) {
        setCountdownActive(false)
        return
      }

      setCountdownActive(true)
      const remaining = Math.max(0, expiry - Date.now())
      setCountdown(formatCountdown(remaining))

      if (remaining <= 0) {
        const loggedInToken = localStorage.getItem(LOGGED_IN)
        const stickyNoteId = loggedInToken?.split('_')[0]

        if (stickyNoteId) {
          await markStickyNoteExpired(stickyNoteId)
        }

        clearStickyNoteOpenedAt(stickyCode)
        localStorage.removeItem(LOGGED_IN)
        localStorage.removeItem(STICKY_CODE_KEY)
        setLoggedIn(false)
        setStickyCode('')
        setSaveMessageState(null)
        setStickyCodeError('This sticky note has expired.')
      }
    }

    void updateCountdown()
    timerId = window.setInterval(() => {
      void updateCountdown()
    }, 1000)

    return () => {
      if (timerId) {
        window.clearInterval(timerId)
      }
    }
  }, [loggedIn, stickyCode])

  const setSaveMessageState = (value: string | null) => {
    setSavedMessage(value)
  }

  /** Generates a code and places it in the sticky-code input. */
  const createStickyCode = () => {
    const newStickyCode = generateCityToken()
    setStickyCode(newStickyCode)
    setStickyCodeInput(newStickyCode)
    setStickyCodeError('')
  }

  /** Validates and formats the sticky code while the user types. */
  const handleStickyCodeInputChange = (value: string) => {
    const normalized = normalizeStickyCode(value)
    setStickyCodeInput(normalized)

    if (!normalized) {
      setStickyCodeError('Please enter a sticky code.')
      return
    }

    if (!isValidStickyCode(normalized)) {
      setStickyCodeError('Sticky code must be exactly 8 characters, letters and numbers only, with no spaces.')
      return
    }

    setStickyCodeError('')
  }

  /** Closes the active sticky note and clears the local session. */
  const handleLogout = () => {
    setShowCloseConfirm(false)
    localStorage.removeItem(LOGGED_IN)
    localStorage.removeItem(STICKY_CODE_KEY)
    setLoggedIn(false)
    setStickyCode('')
    setStickyCodeInput('')
    setInputValue('')
    setSavedMessage(null)
    setCountdownActive(false)
  }

  /** Opens an existing sticky note after validating its code. */
  const openStickyNoteHandler = async () => {
    const code = normalizeStickyCode(stickyCodeInput)
    if (!isValidStickyCode(code)) {
      setStickyCodeError('Sticky code must be exactly 8 characters, letters and numbers only, with no spaces.')
      return
    }

    const loadingStartedAt = Date.now()
    setLoading(true)
    const [exists, stickyNote] = await stickyCodeExists(code)

    if (!exists || !stickyNote) {
      await waitForLoader(loadingStartedAt)
      setLoading(false)
      setStickyCodeError(`Sticky code does not exist. Would you like to create sticky note - ${stickyCodeInput.trim()}?`)
      return
    }

    const stickyNoteRecord = await getStickyNoteByCode(code)
    if (
      stickyNoteRecord &&
      (stickyNoteRecord.status === STICKY_NOTE_STATUS_EXPIRED || isStickyNoteExpiredRecord(stickyNoteRecord))
    ) {
      await markStickyNoteExpired(stickyNote.id)
      clearStickyNoteOpenedAt(code)
      await waitForLoader(loadingStartedAt)
      setLoading(false)
      setStickyCodeError('This sticky note has expired.')
      return
    }

    if (stickyNoteRecord && (!stickyNoteRecord.opened_at || !stickyNoteRecord.expires_at)) {
      const openedStickyNote = await openStickyNoteWindow(stickyNote.id)
      if (!openedStickyNote) {
        await waitForLoader(loadingStartedAt)
        setLoading(false)
        setStickyCodeError('This sticky note has refused to be opened. Please try again.')
        return
      }
    }

    setLoggedIn(true)
    setStickyCode(code)
    setStickyCodeInput(code)
    localStorage.setItem(LOGGED_IN, `${stickyNote.id}_${code}`)
    localStorage.setItem(STICKY_CODE_KEY, code)
    const latestMessage = await getLatestMessage(stickyNote.id)
    if (latestMessage) {
      setSaveMessageState(latestMessage.message)
    } else {
      setSaveMessageState(null)
    }

    setStickyCodeError('')
    await waitForLoader(loadingStartedAt)
    setLoading(false)
  }

  /** Creates a new sticky note from the entered code. */
  const createStickyNoteHandler = async () => {
    const code = normalizeStickyCode(stickyCodeInput)
    if (!isValidStickyCode(code)) {
      setStickyCodeError('Sticky code must be exactly 8 characters, letters and numbers only, with no spaces.')
      return
    }

    const loadingStartedAt = Date.now()
    setLoading(true)

    try {
      const createdNote = await createStickyNote(code)
      if (!createdNote) {
        throw new Error('Failed to create sticky note record.')
      }

      setStickyCode(code)
      setStickyCodeInput(code)
      localStorage.setItem(STICKY_CODE_KEY, code)
      localStorage.setItem(LOGGED_IN, `${createdNote.id}_${code}`)
      setSaveMessageState(null)
      setLoggedIn(true)
      setStickyCodeError('')
      await waitForLoader(loadingStartedAt)
      setLoading(false)
    } catch {
      await waitForLoader(loadingStartedAt)
      setStickyCodeError('Failed to create sticky note. Please try again.')
      setLoading(false)
    }
  }

  /** Saves the message written in the note composer. */
  const handleSendMessage = async () => {
    if (!inputValue.trim()) {
      return
    }

    const loggedInToken = localStorage.getItem(LOGGED_IN)
    if (!loggedInToken) {
      setStickyCodeError('You must be logged in to send a message.')
      return
    }

    const stickyNoteId = loggedInToken.split('_')[0]
    try {
      await saveMessage(inputValue, stickyNoteId)
      setSaveMessageState(inputValue)
      setInputValue('')
    } catch {
      setStickyCodeError('Failed to send the sticky note. Please try again.')
    }
  }

  /** Checks the initial sticky code and initializes the note on mount. */
  useEffect(() => {
    const loadingStartedAt = Date.now()
    const token = getStickyCode()

    const initializeStickyNote = async () => {
      if (token) {
        const [exists, stickyNote] = await stickyCodeExists(token)

        if (!exists || !stickyNote) {
          setLoggedIn(false)
          localStorage.clear()
          setStickyCodeError(`Sticky code does not exist. Would you like to create sticky note - ${token}?`)
        } else {
          const stickyNoteRecord = await getStickyNoteByCode(token)
          if (
            stickyNoteRecord &&
            (stickyNoteRecord.status === STICKY_NOTE_STATUS_EXPIRED || isStickyNoteExpiredRecord(stickyNoteRecord))
          ) {
            await markStickyNoteExpired(stickyNote.id)
            clearStickyNoteOpenedAt(token)
            localStorage.clear()
            setStickyCodeError('This sticky note has expired.')
            setStickyCode('')
            setStickyCodeInput('')
            setLoggedIn(false)
            await waitForLoader(loadingStartedAt)
            setLoading(false)
            return
          }

          const tokenValue = localStorage.getItem(LOGGED_IN)
          if (tokenValue) {
            setLoggedIn(true)
            setStickyCode(token)
            setStickyCodeInput(token)
            await loadLatestNoteMessage(stickyNote.id)
          }
        }
      }

      setStickyCode(token)
      setStickyCodeInput(token)
      await waitForLoader(loadingStartedAt)
      setLoading(false)
    }

    void initializeStickyNote()
  }, [])

  return (
    <main
      className="flex min-h-screen items-center justify-center px-5"
      style={{
        background:
          'radial-gradient(circle at top left, rgba(235, 86, 86, 0.74), transparent 30%), radial-gradient(circle at bottom right, rgba(255, 255, 255, 0.2), transparent 25%), linear-gradient(135deg, #f7d77a, #f4a261, #c77dff, #9ec5fe)',
        fontFamily: 'Comic Sans MS, Trebuchet MS, cursive, sans-serif',
      }}
    >
      <div className="sticker-card">
        <div className="paper-tape" />
        <div className="sticker-tag">{stickyCode || 'sticky note'}</div>

        <div className="message-layout">
          {loading ? (
            <Loader label="Opening sticky note" />
          ) : loggedIn ? (
            <>
              {savedMessage ? (
                <div className="note-read-only">
                  <h1 className="message-title message-title--saved">{savedMessage}</h1>
                  {countdownActive && (
                    <p className="temporary-copy">This note will self-destruct in {countdown}</p>
                  )}
                </div>
              ) : (
                <div className="composer-box">
                  <div className="composer-header">Temporary sticky note</div>
                  <textarea
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    placeholder="Tell me something... anything..."
                    aria-label="Message"
                  />
                  <p className="temporary-copy">
                    This note stays available for 3 hours after it is opened.
                  </p>
                  <button type="button" className="send-btn" onClick={handleSendMessage}>
                    Send note
                  </button>
                </div>
              )}

              {showCloseConfirm && (
                <div className="close-confirmation-backdrop" role="dialog" aria-modal="true">
                  <div className="close-confirmation">
                    <p className="close-confirmation__title">This sticky note is temporary.</p>
                    <p>
                      Closing it hides it, but the timer continues. The note will self-destruct when the timer ends.
                    </p>
                    <div className="button-row">
                      <button type="button" className="yes-btn" onClick={handleLogout}>
                        Close note
                      </button>
                      <button type="button" className="no-btn" onClick={() => setShowCloseConfirm(false)}>
                        Keep it open
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!showCloseConfirm && (
                <button type="button" className="logout-btn" onClick={() => setShowCloseConfirm(true)}>
                  Close Sticky Note
                </button>
              )}
            </>
          ) : (
            <div className="note-box">
              <div className="room-badge">
                Sticky code: <strong>{stickyCode || 'Not selected'}</strong>
              </div>

              <div className="join-panel">
                <label className="field-label">Sticky code</label>
                <div className="sticky-code-input-area">
                  <input
                    value={stickyCodeInput}
                    onChange={(event) => handleStickyCodeInputChange(event.target.value)}
                    placeholder="Type or Generate a sticky code"
                    className={`room-input ${stickyCodeError ? 'border-red-500' : ''}`}
                  />
                  <button type="button" className="generate-code-btn" onClick={createStickyCode}>
                    Generate code
                  </button>
                </div>

                {stickyCodeError && <p className="error-text">{stickyCodeError}</p>}

                <div className="button-grid">
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => {
                      if (stickyCodeError.includes('Would you like to create sticky note')) {
                        setStickyCodeError('')
                      } else {
                        void openStickyNoteHandler()
                      }
                    }}
                  >
                    {stickyCodeError.includes('Would you like to create sticky note') ? 'No, cancel' : 'Open sticky note'}
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => void createStickyNoteHandler()}>
                    {stickyCodeError.includes('Would you like to create sticky note') ? 'Yes, create it' : 'Create new sticky note'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default App
