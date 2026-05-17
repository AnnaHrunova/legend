import { useMemo } from 'react';
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

export function MobileVoiceTestPage() {
  const [searchParams] = useSearchParams();
  const serverUrl = searchParams.get('serverUrl') ?? '';
  const token = searchParams.get('token') ?? '';
  const roomName = searchParams.get('roomName') ?? '';
  const ticketId = searchParams.get('ticketId') ?? '';
  const name = searchParams.get('name') ?? 'Mobile customer';
  const missing = useMemo(
    () => [
      !serverUrl ? 'serverUrl' : undefined,
      !token ? 'token' : undefined,
      !roomName ? 'roomName' : undefined,
    ].filter(Boolean),
    [roomName, serverUrl, token],
  );

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

        {missing.length ? (
          <div className="mobile-voice-error">
            Missing LiveKit params: {missing.join(', ')}.
          </div>
        ) : (
          <LiveKitRoom
            audio
            connect
            serverUrl={serverUrl}
            token={token}
            className="mobile-voice-room"
          >
            <RoomAudioRenderer />
            <MobileVoiceTelemetry name={name} roomName={roomName} ticketId={ticketId} />
            <ControlBar controls={{ camera: false, screenShare: false, chat: false }} />
          </LiveKitRoom>
        )}

        {ticketId && (
          <Link className="mobile-voice-back-link" to={`/tickets/${ticketId}`}>
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
