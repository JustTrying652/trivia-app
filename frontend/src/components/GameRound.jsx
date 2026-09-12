import { useEffect, useState } from 'react'

const ANSWER_STYLES = [
  { color: 'var(--coral)', shape: 'triangle' },
  { color: 'var(--cyan)', shape: 'diamond' },
  { color: 'var(--gold)', shape: 'circle' },
  { color: 'var(--green)', shape: 'square' },
]

export default function GameRound({ question, answerResult, roundResult, isHost, onAnswer, onNextRound }) {
  const [selected, setSelected] = useState(null)
  const [remaining, setRemaining] = useState(question.duration)

  // Reset local "which answer did I pick" state every time a genuinely new question arrives.
  useEffect(() => {
    setSelected(question.already_answered ? '(already answered)' : null)
  }, [question])

  // Cosmetic countdown only — the server is what actually closes the round.
  useEffect(() => {
    const tick = () => {
      const secondsLeft = Math.max(0, question.ends_at - Date.now() / 1000)
      setRemaining(secondsLeft)
    }
    tick()
    const interval = setInterval(tick, 200)
    return () => clearInterval(interval)
  }, [question])

  function handlePick(choice) {
    if (selected) return // already answered, ignore further clicks
    setSelected(choice)
    onAnswer(choice)
  }

  const revealed = Boolean(roundResult)

  return (
    <div style={styles.wrap}>
      <div style={styles.top}>
        <h1 style={styles.question}>{question.question}</h1>
        {!revealed && <div style={styles.timer}>{Math.ceil(remaining)}s</div>}
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
        width: 0,
        height: 0,
        background: 'transparent',
        borderLeft: '14px solid transparent',
        borderRight: '14px solid transparent',
        borderBottom: '24px solid currentColor',
      }
    default: // square
      return { borderRadius: '6px' }
  }
}

const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', gap: '20px' },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  question: { fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, maxWidth: '80%' },
  timer: {
    fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700,
    background: 'var(--surface)', padding: '8px 16px', borderRadius: '10px',
  },
  feedback: { fontWeight: 600, margin: 0 },
  grid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', flex: 1,
  },
  answerBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '10px', borderRadius: '16px', color: 'var(--bg)', fontWeight: 700,
    fontFamily: 'var(--font-display)', fontSize: '1.1rem', padding: '16px',
  },
  shape: { width: '28px', height: '28px', background: 'currentColor', color: 'var(--bg)' },
  reveal: {
    background: 'var(--surface)', borderRadius: '16px', padding: '20px', display: 'flex',
    flexDirection: 'column', gap: '12px',
  },
  revealAnswer: { fontFamily: 'var(--font-display)', fontSize: '1.2rem', margin: 0 },
  scoreboard: { margin: 0, paddingLeft: '20px' },
  nextBtn: {
    alignSelf: 'flex-start', padding: '12px 20px', borderRadius: '10px',
    background: 'var(--gold)', color: 'var(--bg)', fontWeight: 700,
    fontFamily: 'var(--font-display)',
  },
}