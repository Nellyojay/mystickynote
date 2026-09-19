import { useEffect, useState } from 'react'
import { generateCityToken, getStickyCode, STICKY_CODE_KEY } from './services/getToken'
import { isValidStickyCode, normalizeStickyCode } from './services/fns'
import { createStickyNote, getLatestMessage, LOGGED_IN, saveMessage, stickyCodeExists } from './services/messages'
import Loader from './pages/components/loader'
import './styles/sticker-card.css'

const LOCKOUT_MS = 3 * 60 * 60 * 1000
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
  const [sentAt, setSentAt] = useState<number | null>(null)
  const [countdown, setCountdown] = useState('')
  const [response, setResponse] = useState<'yes' | 'no' | null>(null)
  const [showInput, setShowInput] = useState(false)
  const [stickyCode, setStickyCode] = useState('')
  const [stickyCodeInput, setStickyCodeInput] = useState(() => getStickyCode())
  const [stickyCodeError, setStickyCodeError] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const value = sentAt || showInput || setCountdown('') || formatCountdown(LOCKOUT_MS)
    console.log(value);
  }, [])

  useEffect(() => {
    /** Loads the latest message for the active sticky note. */
    const loadLatestMessage = async () => {
      const loggedInToken = localStorage.getItem(LOGGED_IN)
      const [_exists, stickyNote] = await stickyCodeExists(stickyCode)
      const stickyNoteId = loggedInToken?.split('_')[0] || stickyNote?.id

      if (stickyNoteId) {
        const message = await getLatestMessage(stickyNoteId)
        if (message) {
          setSavedMessage(message.message)
        }
      }
    }

    void loadLatestMessage()
  }, [stickyCode, loggedIn])

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
    localStorage.clear()
    setLoggedIn(false)
    setStickyCode('')
    setStickyCodeInput('')
    setSavedMessage(null)
    setInputValue('')
    setResponse(null)
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

    if (exists && stickyNote) {
      setLoggedIn(exists)
      setStickyCode(code)

      localStorage.setItem(LOGGED_IN, `${stickyNote.id}_${code}`)
      localStorage.setItem(STICKY_CODE_KEY, code)
      await waitForLoader(loadingStartedAt)
      setLoading(false)
      setStickyCodeError('')
    } else {
      await waitForLoader(loadingStartedAt)
      setLoading(false)
      setStickyCodeError(`Sticky code does not exist. Would you like to create sticky note - ${stickyCodeInput.trim()}?`)
    }
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
      await createStickyNote(code)
      setLoggedIn(true)
      setStickyCode(code)
      setStickyCodeInput(code)
      localStorage.setItem(STICKY_CODE_KEY, code)
      await waitForLoader(loadingStartedAt)
      setStickyCodeError('')
      setLoading(false)
    } catch (error) {
      await waitForLoader(loadingStartedAt)
      setStickyCodeError('Failed to create sticky note. Please try again.')
      setLoading(false)
    }
  }

  /** Saves the message written in the note composer. */
  const handleSendMessage = async () => {
    if (!inputValue.trim()) {
      return;
    }

    const loggedInToken = localStorage.getItem(LOGGED_IN)
    if (!loggedInToken) {
      setStickyCodeError('You must be logged in to send a message.')
      return
    }

    const stickyNoteId = loggedInToken.split('_')[0]
    try {
      await saveMessage(inputValue, stickyNoteId)
      setSavedMessage(inputValue)
      setInputValue('')
      setSentAt(Date.now())
      setShowInput(false)
    } catch (error) {
      return;
    }
  }

  /** Checks the initial sticky code and initializes the note on mount. */
  useEffect(() => {
    const loadingStartedAt = Date.now()
    const token = getStickyCode()

    /** Validates the stored code before displaying the sticky note. */
    const initializeStickyNote = async () => {
      if (token) {

        const [exists] = await stickyCodeExists(token)

        if (!exists) {
          setLoggedIn(false)
          localStorage.clear();
          setStickyCodeError(`Sticky code does not exist. Would you like to create sticky note - ${token}?`);
        } else {
          setStickyCodeError('')
        }
      }

      setStickyCode(token)
      setResponse(null)
      setStickyCodeInput(token)
      setLoggedIn(Boolean(localStorage.getItem(LOGGED_IN)))
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
      <div className={`sticker-card ${response ? 'sticker-card--celebrate' : ''}`}>
        <div className="paper-tape" />
        <div className="sticker-tag sticky top-2 z-10">{stickyCode || 'sticky note'}</div>

        {response === 'yes' ? (
          <div className="status-panel status-panel--yes">
            <div className="emoji">😊</div>
            <div className="status-title">Yaaayy 😊 0786911950</div>
            <p className="status-copy">
              Call me some time so we can make plans 😊
            </p>
          </div>
        ) : response === 'no' ? (
          <div className="status-panel status-panel--no">
            <div className="emoji">😭</div>
            <p className="status-copy">
              eh maama nawe Nakamate😭😭. Anyway kale, I respect your decision.
              <br />
              <br />
              I hope you have a great day😊 kasta u ate enough cake😊
            </p>
          </div>
        ) : null}

        <div className="message-layout">
          {loading ? (
            <Loader label="Opening sticky note" />
          ) : loggedIn ? (
            <>
              <h1
                key={savedMessage || 'welcome-message'}
                className={`message-title ${savedMessage ? 'message-title--saved' : ''}`}
              >
                {savedMessage || 'Welcome to myStickyNote'}
              </h1>

              <div className="sticky bottom-2 z-10">
                <div className="composer-box">
                  <textarea
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    placeholder="Tell me something... anything..."
                    aria-label="Message"
                  />
                  <p className="small-note hidden">
                    You can only reply or get a reply after 3 hours. so take your time and
                    write your sweet thoughts
                  </p>
                  <button
                    type="button"
                    className="send-btn mb-4"
                    onClick={handleSendMessage}
                  >
                    Send a little note
                  </button>
                </div>

                <div className="countdown">{countdown}</div>

                <button
                  type="button"
                  className="logout-btn"
                  onClick={handleLogout}
                >
                  Close Sticky Note
                </button>
              </div>
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
                  <button
                    type="button"
                    className="generate-code-btn"
                    onClick={createStickyCode}
                  >
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
                        openStickyNoteHandler()
                      }
                    }}
                  >
                    {stickyCodeError.includes('Would you like to create sticky note') ? 'No, cancel' : 'Open sticky note'}
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={createStickyNoteHandler}
                  >
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
