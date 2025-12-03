import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Send, Camera, Clock, Ghost, AlertTriangle } from "lucide-react";
import { 
  getRoomByCode, 
  sendMessage, 
  subscribeToMessages, 
  subscribeToRoom,
  getParticipantId,
  formatTimeRemaining,
  isTimeUrgent,
  expireRoom
} from "@/lib/room";
import { toast } from "sonner";

interface Message {
  id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  message_type: 'text' | 'image';
  created_at: string;
}

const ChatRoom = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('--:--');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const participantId = getParticipantId();

  // Load room data
  useEffect(() => {
    const loadRoom = async () => {
      if (!code) return;
      
      const roomData = await getRoomByCode(code);
      
      if (!roomData) {
        toast.error("Room not found");
        navigate('/');
        return;
      }

      if (roomData.status === 'expired' || new Date(roomData.expires_at) < new Date()) {
        setIsExpired(true);
        return;
      }

      setRoom(roomData);
    };

    loadRoom();
  }, [code, navigate]);

  // Subscribe to messages
  useEffect(() => {
    if (!room) return;

    const unsubscribe = subscribeToMessages(room.id, (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
    });

    return () => unsubscribe();
  }, [room]);

  // Subscribe to room status changes
  useEffect(() => {
    if (!room) return;

    const unsubscribe = subscribeToRoom(room.id, (updatedRoom) => {
      if (updatedRoom.status === 'expired') {
        setIsExpired(true);
      }
      setRoom(updatedRoom);
    });

    return () => unsubscribe();
  }, [room]);

  // Timer countdown
  useEffect(() => {
    if (!room || isExpired) return;

    const interval = setInterval(() => {
      const remaining = formatTimeRemaining(room.expires_at);
      setTimeRemaining(remaining);
      setIsUrgent(isTimeUrgent(room.expires_at));

      // Check if expired
      if (new Date(room.expires_at) <= new Date()) {
        setIsExpired(true);
        expireRoom(room.id);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [room, isExpired]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !room || isSending) return;

    setIsSending(true);
    const messageContent = inputValue.trim();
    setInputValue('');

    try {
      await sendMessage(room.id, messageContent, participantId, 'text');
    } catch (error) {
      toast.error("Failed to send message");
      setInputValue(messageContent);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      toast.error("Could not access camera");
      setShowCamera(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !room) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      // Stop camera
      const stream = video.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      setShowCamera(false);

      // Send as message
      try {
        await sendMessage(room.id, '', participantId, 'image', imageData);
        toast.success("Photo sent");
      } catch {
        toast.error("Failed to send photo");
      }
    }
  };

  const closeCamera = () => {
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  // Expired state
  if (isExpired) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center px-6">
        <div className="text-center fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-surface-elevated border border-border/50 mb-6">
            <Ghost className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Chat Ended</h1>
          <p className="text-muted-foreground mb-8 max-w-sm">
            This conversation has self-destructed. All messages have been permanently deleted.
          </p>
          <Button variant="hero" size="lg" onClick={() => navigate('/')}>
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-dark flex flex-col relative">
      {/* Camera overlay */}
      {showCamera && (
        <div className="absolute inset-0 z-50 bg-background flex flex-col">
          <video ref={videoRef} autoPlay playsInline className="flex-1 object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background to-transparent">
            <div className="flex justify-center gap-4">
              <Button variant="secondary" size="lg" onClick={closeCamera}>
                Cancel
              </Button>
              <Button variant="hero" size="lg" onClick={capturePhoto}>
                <Camera className="w-5 h-5 mr-2" />
                Capture
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-border/50 bg-surface/60 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ghost className="w-5 h-5 text-primary" />
            <span className="font-mono text-sm text-muted-foreground">{code}</span>
          </div>
          <div className={`flex items-center gap-2 font-mono text-sm ${isUrgent ? 'timer-urgent' : 'text-foreground'}`}>
            <Clock className="w-4 h-4" />
            {timeRemaining}
          </div>
        </div>
        {room.status === 'waiting' && (
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-primary rounded-full pulse-ghost" />
            Waiting for someone to join...
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm max-w-xs">
              Messages in this room are ephemeral. They will be destroyed when the timer ends.
            </p>
          </div>
        )}
        
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.sender_id === participantId}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-border/50 bg-surface/60 backdrop-blur-xl">
        <div className="flex items-end gap-2">
          <Button
            variant="glass"
            size="icon"
            onClick={startCamera}
            className="flex-shrink-0"
          >
            <Camera className="w-5 h-5" />
          </Button>
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-3 bg-secondary border border-border/50 rounded-xl resize-none focus:outline-none focus:border-primary/50 focus:shadow-ghost transition-all text-foreground placeholder:text-muted-foreground"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <Button
            variant="hero"
            size="icon"
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending}
            className="flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const MessageBubble = ({ message, isOwn }: { message: Message; isOwn: boolean }) => {
  const isImage = message.message_type === 'image';

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={`
          max-w-[80%] rounded-2xl overflow-hidden
          ${isOwn 
            ? 'bg-primary text-primary-foreground rounded-br-md' 
            : 'bg-secondary text-secondary-foreground rounded-bl-md'
          }
          ${isImage ? 'p-1' : 'px-4 py-2'}
        `}
      >
        {isImage && message.image_url ? (
          <img 
            src={message.image_url} 
            alt="Shared photo" 
            className="max-w-full rounded-xl"
            style={{ maxHeight: '300px' }}
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        )}
      </div>
    </div>
  );
};

export default ChatRoom;