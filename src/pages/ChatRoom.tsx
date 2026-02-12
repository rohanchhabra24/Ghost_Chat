import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Send, Camera, Clock, Ghost, AlertTriangle, DollarSign } from "lucide-react";
import {
  getRoomByCode,
  sendMessage,
  getMessages,
  subscribeToMessages,
  subscribeToRoom,
  getSessionToken,
  formatTimeRemaining,
  isTimeUrgent,
  expireRoom
} from "@/lib/room";
import { encryptMessage, decryptMessage } from "@/lib/crypto";
import { WalletButton } from "@/components/WalletButton";
import { SendCryptoModal } from "@/components/SendCryptoModal";
import { PaymentMessage } from "@/components/PaymentMessage";
import { isWalletConnected, getWalletAddress } from "@/lib/wallet";
import { toast } from "sonner";


interface Message {
  id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  message_type: 'text' | 'image' | 'payment_request' | 'payment_sent';
  created_at: string;
  // Payment-specific fields
  payment_amount?: string;
  payment_token?: 'MATIC' | 'ETH' | 'USDC';
  payment_to?: string;
  payment_tx_hash?: string;
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
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [showSendCrypto, setShowSendCrypto] = useState(false);
  const [peerWalletAddress, setPeerWalletAddress] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionToken = getSessionToken();

  // Load room data and initial messages
  useEffect(() => {
    const loadRoom = async () => {
      if (!code) return;

      // Require valid session token
      if (!sessionToken) {
        toast.error("Session not found. This room requires a fresh join.");
        navigate('/');
        return;
      }

      const roomData = await getRoomByCode(code);

      if (!roomData) {
        toast.error("Room not found or you don't have access");
        navigate('/');
        return;
      }

      if (roomData.status === 'expired' || new Date(roomData.expires_at) < new Date()) {
        setIsExpired(true);
        return;
      }

      setRoom(roomData);

      // Load and decrypt initial messages
      const initialMessages = await getMessages(roomData.id);
      const decryptedMessages = await Promise.all(initialMessages.map(async (m: any) => ({
        ...m,
        content: m.content ? await decryptMessage(m.content, code) : m.content,
        image_url: (m.message_type === 'image' && m.image_url) ? await decryptMessage(m.image_url, code) : m.image_url
      })));
      setMessages(decryptedMessages);
    };

    loadRoom();
  }, [code, navigate, sessionToken]);

  // Subscribe to messages
  useEffect(() => {
    if (!room?.id || !code) return;

    const unsubscribe = subscribeToMessages(room.id, async (newMessage) => {
      // Decrypt message content if it exists
      if (newMessage.content) {
        newMessage.content = await decryptMessage(newMessage.content, code);
      }
      // Decrypt image_url if it's an image message (it contains the encrypted data URL)
      if (newMessage.message_type === 'image' && newMessage.image_url) {
        newMessage.image_url = await decryptMessage(newMessage.image_url, code);
      }
      setMessages((prev) => [...prev, newMessage]);
    });

    return () => unsubscribe();
  }, [room?.id, code]);

  // Subscribe to room status changes
  useEffect(() => {
    if (!room?.id) return;

    const unsubscribe = subscribeToRoom(room.id, (updatedRoom) => {
      if (updatedRoom.status === 'expired') {
        setIsExpired(true);
      }
      setRoom(updatedRoom);
    });

    return () => unsubscribe();
  }, [room?.id]);

  // Timer countdown and polling fallback for status
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

    // Fallback polling for status change (Realtime rooms table RLS issue)
    let pollInterval: any;
    if (room.status === 'waiting') {
      pollInterval = setInterval(async () => {
        const roomData = await getRoomByCode(code!);
        if (roomData && roomData.status !== 'waiting') {
          setRoom(roomData);
        }
      }, 3000);
    }

    return () => {
      clearInterval(interval);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [room?.id, room?.status, isExpired, code]);

  // Handle window focus/blur for privacy (best effort screenshot/glance protection)
  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Decrypt initial messages
  useEffect(() => {
    const decryptInitial = async () => {
      if (messages.length > 0 && code && messages.some(m => m.content?.startsWith('W'))) { // Simple heuristic to avoid re-decrypting
        const decrypted = await Promise.all(messages.map(async m => {
          if (m.content && m.content.includes('==') || m.content?.length > 20) { // Very basic check for base64
            // We actually need to know if it's encrypted. 
            // For now we'll just decrypt everything that looks like it needs it.
            return {
              ...m,
              content: m.content ? await decryptMessage(m.content, code) : m.content,
              image_url: (m.message_type === 'image' && m.image_url) ? await decryptMessage(m.image_url, code) : m.image_url
            };
          }
          return m;
        }));
        // setMessages(decrypted); // Careful with infinite loops here
      }
    };
    // This is handled better by ensuring getMessages returns decrypted data or 
    // decrypting right after fetch.
  }, [messages.length, code]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !room || isSending || !sessionToken) return;

    setIsSending(true);
    const messageContent = inputValue.trim();
    setInputValue('');

    try {
      const encryptedContent = await encryptMessage(messageContent, code!);
      await sendMessage(room.id, encryptedContent, sessionToken, 'text');
    } catch (error) {
      toast.error("Failed to send message");
      setInputValue(messageContent);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        if (sessionToken && code) {
          const encryptedImage = await encryptMessage(imageData, code);
          await sendMessage(room.id, '', sessionToken, 'image', encryptedImage);
          toast.success("Photo sent");
        } else {
          toast.error("Session expired");
        }
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

  // Payment handlers
  const handleSendCryptoClick = async () => {
    if (!isWalletConnected()) {
      toast.error('Please connect your wallet first');
      return;
    }
    setShowSendCrypto(true);
  };

  const handlePaymentSuccess = async (txHash: string, amount: string, token: string) => {
    if (!room || !sessionToken || !code) return;

    try {
      const recipientAddr = peerWalletAddress || await getWalletAddress();

      // Create payment message
      const paymentData = {
        type: 'payment_sent',
        amount,
        token,
        txHash,
        recipientAddress: recipientAddr
      };

      // Encrypt and send payment message
      const encryptedPayment = await encryptMessage(JSON.stringify(paymentData), code);
      await sendMessage(room.id, encryptedPayment, sessionToken, 'payment_sent');

      toast.success('Payment sent successfully!');
    } catch (error) {
      console.error('Failed to send payment message:', error);
      toast.error('Payment sent but failed to notify in chat');
    }
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
    <div className={`h-screen bg-gradient-dark flex flex-col relative transition-all duration-500 ${!isWindowFocused ? 'blur-xl grayscale' : ''}`}>
      {/* Privacy overlay */}
      {!isWindowFocused && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-background/20 backdrop-blur-md">
          <div className="text-center p-6 rounded-2xl bg-surface/80 border border-border/50 shadow-2xl scale-in">
            <Ghost className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
            <h2 className="text-xl font-bold text-foreground mb-1">Privacy Mode</h2>
            <p className="text-muted-foreground text-sm">Click anywhere to resume chat</p>
          </div>
        </div>
      )}

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
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 font-mono text-sm ${isUrgent ? 'timer-urgent' : 'text-foreground'}`}>
              <Clock className="w-4 h-4" />
              {timeRemaining}
            </div>
            <WalletButton />
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

        {messages.map((message) => {
          if (message.message_type === 'payment_sent' || message.message_type === 'payment_request') {
            // Parse content if it's a JSON string (for backward compatibility or direct usage)
            let paymentData: any = {};
            try {
              paymentData = typeof message.content === 'string' && message.content.startsWith('{')
                ? JSON.parse(message.content)
                : {};
            } catch (e) {
              // content might not be JSON if it's legacy or error
            }

            return (
              <PaymentMessage
                key={message.id}
                type={message.message_type as any}
                amount={message.payment_amount || paymentData.amount || '0'}
                token={message.payment_token || paymentData.token || 'MATIC'}
                txHash={message.payment_tx_hash || paymentData.txHash}
                recipientAddress={message.payment_to || paymentData.recipientAddress}
                isSender={message.sender_id === sessionToken}
              />
            );
          }

          return (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.sender_id === sessionToken}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <SendCryptoModal
        open={showSendCrypto}
        onClose={() => setShowSendCrypto(false)}
        recipientAddress={peerWalletAddress || undefined}
        onSuccess={handlePaymentSuccess}
      />

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
          <Button
            variant="glass"
            size="icon"
            onClick={handleSendCryptoClick}
            className="flex-shrink-0 text-primary hover:text-primary/80"
          >
            <DollarSign className="w-5 h-5" />
          </Button>
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
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