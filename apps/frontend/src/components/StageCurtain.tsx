import { PropsWithChildren, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TripControlsProps, TripSummary } from './TripControls'
import styles from './StageCurtain.module.css'

type PlannerRenderer = (props: TripControlsProps) => ReactNode
type VoiceRenderer = (props: VoiceRendererProps) => ReactNode

interface StageCurtainProps {
  renderPlanner: PlannerRenderer
  renderVoice: VoiceRenderer
  onTripReady?: (summary: TripSummary) => void
}

interface VoiceRendererProps {
  className?: string
  ariaHidden?: boolean
  summary?: TripSummary | null
}

type StageMode = 'planner' | 'transitioning' | 'voice'

export function StageCurtain({ renderPlanner, renderVoice, onTripReady }: StageCurtainProps) {
  const [stageMode, setStageMode] = useState<StageMode>('planner')
  const [currentSummary, setCurrentSummary] = useState<TripSummary | null>(null)
  const [animationFlag, setAnimationFlag] = useState<'idle' | 'lifting' | 'settled'>('idle')
  const revealTimeoutRef = useRef<number | null>(null)
  const idleTimeoutRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (revealTimeoutRef.current !== null) {
      window.clearTimeout(revealTimeoutRef.current)
      revealTimeoutRef.current = null
    }
    if (idleTimeoutRef.current !== null) {
      window.clearTimeout(idleTimeoutRef.current)
      idleTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  const handlePlannerReady = useCallback(
    (summary: TripSummary) => {
      clearTimers()
      setCurrentSummary(summary)
      onTripReady?.(summary)
      setStageMode('transitioning')
      setAnimationFlag('lifting')

      window.requestAnimationFrame(() => {
        revealTimeoutRef.current = window.setTimeout(() => {
          setAnimationFlag('settled')
          setStageMode('voice')

          idleTimeoutRef.current = window.setTimeout(() => {
            setAnimationFlag('idle')
            idleTimeoutRef.current = null
          }, 1200)

          revealTimeoutRef.current = null
        }, 550)
      })
    },
    [onTripReady, clearTimers],
  )

  const handleEditTrip = useCallback(() => {
    clearTimers()
    setCurrentSummary(null)
    setStageMode('planner')
    setAnimationFlag('idle')
  }, [clearTimers])

  const stageClassName = useMemo(() => {
    const base = [styles.stage]
    if (stageMode === 'transitioning') {
      base.push(styles.stageTransitioning)
    }
    if (stageMode === 'voice') {
      base.push(styles.stageVoice)
    }
    if (animationFlag === 'lifting') {
      base.push(styles.stageLifting)
    }
    if (animationFlag === 'settled') {
      base.push(styles.stageSettled)
    }
    return base.join(' ')
  }, [stageMode, animationFlag])

  const plannerProps: TripControlsProps = {
    className: styles.planner,
    onTripReady: handlePlannerReady,
    ariaHidden: stageMode === 'voice',
    initialCity: currentSummary?.city,
    initialDays: currentSummary?.days,
  }

  const voiceProps: VoiceRendererProps = {
    className: styles.voice,
    ariaHidden: stageMode !== 'voice',
    summary: currentSummary,
  }

  return (
    <div className={styles.stageWrapper} data-stage={stageMode}>
      <div className={stageClassName}>
        <CurtainSide position="front" mode={stageMode}>
          {renderPlanner(plannerProps)}
        </CurtainSide>

        <CurtainSide position="back" mode={stageMode}>
          <div className={styles.voiceContainer}>{renderVoice(voiceProps)}</div>
        </CurtainSide>
      </div>

      {currentSummary && (
        <button
          type="button"
          className={styles.summaryBar}
          onClick={handleEditTrip}
          aria-label="Reset trip planner"
        >
          <span>Reset</span>
        </button>
      )}
    </div>
  )
}

interface CurtainSideProps extends PropsWithChildren {
  position: 'front' | 'back'
  mode: StageMode
}

function CurtainSide({ children, position, mode }: CurtainSideProps) {
  const className = useMemo(() => {
    const base = [styles.curtainSide, position === 'front' ? styles.front : styles.back]
    if (mode === 'transitioning') {
      base.push(styles.curtainTransitioning)
    }
    if (mode === 'voice' && position === 'back') {
      base.push(styles.curtainVisible)
    }
    return base.join(' ')
  }, [position, mode])

  return <div className={className}>{children}</div>
}

