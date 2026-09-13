import { useEffect, useRef, useState } from 'react'
import { playTick, playCorrect, playIncorrect, playRoundStart } from '../sound'

const ANSWER_STYLES = [
  { color: 'var(--coral)', shape: 'triangle' },
  { color: 'var(--cyan)', shape: 'diamond' },
  { color: 'var(--gold)', shape: 'circle' },
  { color: 'var(--green)', shape: 'square' },
]

const RING_RADIUS = 26
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export default function GameRound({ question, answerResult, roundResult, isHost, onAnswer, onNextRound }) {
  const [selected, setSelected] = useState(null)
  const [remaining, setRemaining] = useState(question.duration)
  const lastTickSecond = useRef(null)
  const hasPlayedStartSound = useRef(false)

  useEffect(() => {
    setSelected(question.already_answered ? '(already answered)' : null)
    lastTickSecond.current = null
    hasPlayedStartSound.current = false
  }, [question])

  useEffect(() => {
    if (!hasPlayedStartSound.current) {
      playRoundStart()
      hasPlayedStartSound.current = true
    }

    const tick = () => {
      const secondsLeft = Math.max(0, question.ends_at - Date.now() / 1000)
      setRemaining(secondsLeft)

      const wholeSecond = Math.ceil(secondsLeft)
      if (wholeSecond <= 5 && wholeSecond >= 1 && wholeSecond !== lastTickSecond.current) {
        playTick()
        lastTickSecond.current = wholeSecond
      }
    }
    tick()
    const interval = setInterval(tick, 200)
    return () => clearInterval(interval)
  }, [question])

  // Play a sound the moment we learn our own answer result.
  useEffect(() => {
    if (!answerResult) return
    if (answerResult.correct) playCorrect()
    else playIncorrect()
  }, [answerResult])

  function handlePick(choice) {
    if (selected) return
    setSelected(choice)
    onAnswer(choice)
  }

  const revealed = Boolean(roundResult)
  const progress = Math.max(0, Math.min(1, remaining / question.duration))
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress)

  return (
    <div style={styles.wrap}>
      <div style={styles.top}>
        <h1 style={styles.question}>{question.question}</h1>

        {!revealed && (
          <svg width="64" height="64" viewBox="0 0 64 64" style={styles.ring}>
            <circle cx="32" cy="32" r={RING_RADIUS} stroke="var(--surface)" strokeWidth="6" fill="none" />
            <circle
              cx="32" cy="32" r={RING_RADIUS}
              stroke={progress < 0.25 ? 'var(--coral)' : 'var(--gold)'}
              strokeWidth="6" fill="none"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 32 32)"
              style={{ transition: 'stroke-dashoffset 0.2s linear' }}
            />
            <text x="32" y="37" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--text)" fontFamily="var(--font-display)">
              {Math.ceil(remaining)}
            </text>
          </svg>
        )}
      </div>

      {!revealed && answerResult && (
        <p style={{ ...styles.feedback, color: answerResult.correct ? 'var(--green)' : 'var(--coral)' }}>
          {answerResult.correct ? `Correct! +${answerResult.points}` : 'Answer locked in'}
        </p>
      )}

      <div style={styles.grid}>
        {question.options.map((opt, i) => {
          const style = ANSWER_STYLES[i % ANSWER_STYLES.length]
          const isPicked = selected === opt
          const isCorrectAnswer = revealed && opt === roundResult.answer
          const isWrongPick = revealed && isPicked && !isCorrectAnswer

          return (
            <button
              key={opt}
              onClick={() => handlePick(opt)}
              disabled={Boolean(selected) || revealed}
              style={{
                ...styles.answerBtn,
                background: style.color,
                opacity: revealed && !isCorrectAnswer ? 0.35 : 1,
                outline: isPicked ? '4px solid var(--text)' : 'none',
                animation: isCorrectAnswer
                  ? 'correct-pulse 0.5s ease-in-out'
                  : isWrongPick
                  ? 'wrong-shake 0.4s ease-in-out'
                  : 'none',
              }}
            >
              <span style={{ ...styles.shape, ...shapeStyle(style.shape) }} />
              {opt}
            </button>
          )
        })}
      </div>

      {revealed && (
        <div style={styles.reveal}>
          <p style={styles.revealAnswer}>Answer: {roundResult.answer}</p>
          <ol style={styles.scoreboard}>
            {roundResult.scoreboard.map((p) => (
              <li key={p.nickname}>{p.nickname} — {p.score}</li>
            ))}
          </ol>
          {isHost && (
            <button style={styles.nextBtn} onClick={onNextRound}>
              Next round
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function shapeStyle(shape) {
  switch (shape) {
    case 'circle':
      return { borderRadius: '50%' }
    case 'diamond':
      return { transform: 'rotate(45deg)', borderRadius: '4px' }
    case 'triangle':
      return {
        width: 0, height: 0, background: 'transparent',
        borderLeft: '14px solid transparent', borderRight: '14px solid transparent',
        borderBottom: '24px solid currentColor',
      }
    default:
      return { borderRadius: '6px' }
  }
}

const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', gap: '20px' },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  question: { fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, maxWidth: '75%' },
  ring: { flexShrink: 0 },
  feedback: { fontWeight: 600, margin: 0 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', flex: 1 },
  answerBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '10px', borderRadius: '16px', color: 'var(--bg)', fontWeight: 700,
    fontFamily: 'var(--font-display)', fontSize: '1.1rem', padding: '16px',
    transition: 'transform 0.1s ease',
  },
  shape: { width: '28px', height: '28px', background: 'currentColor', color: 'var(--bg)' },
  reveal: { background: 'var(--surface)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  revealAnswer: { fontFamily: 'var(--font-display)', fontSize: '1.2rem', margin: 0 },
  scoreboard: { margin: 0, paddingLeft: '20px' },
  nextBtn: { alignSelf: 'flex-start', padding: '12px 20px', borderRadius: '10px', background: 'var(--gold)', color: 'var(--bg)', fontWeight: 700, fontFamily: 'var(--font-display)' },
}