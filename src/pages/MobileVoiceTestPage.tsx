import { useMemo, useState } from 'react';
import {
  ControlBar,
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useParticipants,
  useTranscriptions,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { PhoneCall } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { demoVoiceAppContext } from '../data/mockVoiceSupport';
import { startMobileVoiceSession } from '../voice/voiceSessionApi';

export function MobileVoiceTestPage() {
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState({
    serverUrl: searchParams.get('serverUrl') ?? '',
    token: searchParams.get('token') ?? '',
    roomName: searchParams.get('roomName') ?? '',
    ticketId: searchParams.get('ticketId') ?? '',
    name: searchParams.get('name') ?? demoVoiceAppContext.fullName,
  });
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const missing = useMemo(
    () => [
      !session.serverUrl ? 'serverUrl' : undefined,
      !session.token ? 'token' : undefined,
      !session.roomName ? 'roomName' : undefined,
    ].filter(Boolean),
    [session.roomName, session.serverUrl, session.token],
  );
  const canJoin = missing.length === 0;

  async function startVoiceSupport() {
    if (starting) return;
    setStarting(true);
    setError(undefined);
    try {
      const started = await startMobileVoiceSession(demoVoiceAppContext);
      setSession({
        serverUrl: started.livekitUrl ?? '',
        token: started.customerToken ?? '',
        roomName: started.roomName,
        ticketId: started.ticket.id,
        name: demoVoiceAppContext.fullName,
      });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : String(startError));
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="mobile-voice-page">
      <div className="mobile-voice-shell">
        <header>
          <div className="mobile-voice-icon">
            <PhoneCall size={20} />
          </div>
          <div>
            <p className="eyebrow">Mobile app test</p>
            <h1>Voice support</h1>
          </div>
        </header>

        {!canJoin ? (
          <div className="mobile-voice-start">
            <dl>
              <div>
                <dt>User</dt>
                <dd>{demoVoiceAppContext.fullName}</dd>
              </div>
              <div>
                <dt>Screen</dt>
                <dd>{demoVoiceAppContext.currentScreen}</dd>
              </div>
              <div>
                <dt>Last action</dt>
                <dd>{demoVoiceAppContext.lastAction}</dd>
              </div>
            </dl>
            <button type="button" className="primary-button" disabled={starting} onClick={startVoiceSupport}>
              <PhoneCall size={16} />
              {starting ? 'Starting voice' : 'Start voice support'}
            </button>
            {error && <div className="mobile-voice-error">{error}</div>}
            {!error && searchParams.toString() && (
              <div className="mobile-voice-error">
                Missing LiveKit params: {missing.join(', ')}.
              </div>
            )}
          </div>
        ) : (
          <LiveKitRoom
            audio
            connect
            serverUrl={session.serverUrl}
            token={session.token}
            className="mobile-voice-room"
          >
            <RoomAudioRenderer />
            <MobileVoiceTelemetry
              name={session.name}
              roomName={session.roomName}
              ticketId={session.ticketId}
            />
            <ControlBar controls={{ camera: false, screenShare: false, chat: false }} />
          </LiveKitRoom>
        )}

        {session.ticketId && (
          <Link className="mobile-voice-back-link" to={`/tickets/${session.ticketId}`}>
            Back to ticket
          </Link>
        )}
      </div>
    </section>
  );
}

function MobileVoiceTelemetry({
  name,
  roomName,
  ticketId,
}: {
  name: string;
  roomName: string;
  ticketId: string;
}) {
  const connectionState = String(useConnectionState()).toLowerCase();
  const participants = useParticipants();
  const transcriptions = useTranscriptions();

  return (
    <div className="mobile-voice-status">
      <dl>
        <div>
          <dt>User</dt>
          <dd>{name}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{connectionState}</dd>
        </div>
        <div>
          <dt>Room</dt>
          <dd>{roomName}</dd>
        </div>
        {ticketId && (
          <div>
            <dt>Ticket</dt>
            <dd>{ticketId}</dd>
          </div>
        )}
        <div>
          <dt>Participants</dt>
          <dd>{participants.length}</dd>
        </div>
      </dl>

      <div className="mobile-voice-transcript">
        {transcriptions.length ? (
          transcriptions.slice(-5).map((item) => (
            <span key={`${item.participantInfo.identity}-${item.streamInfo.id}`}>
              <strong>{item.participantInfo.identity}</strong>
              {item.text}
            </span>
          ))
        ) : (
          <span>Speak after the room connects. Captions appear when LiveKit publishes transcription.</span>
        )}
      </div>
    </div>
  );
}
