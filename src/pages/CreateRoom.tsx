import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Check, Clock, Loader2 } from "lucide-react";
import { createRoom, getParticipantId } from "@/lib/room";
import { toast } from "sonner";

const DURATION_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 180, label: "3 hours" },
];

const CreateRoom = () => {
  const navigate = useNavigate();
  const [duration, setDuration] = useState(30);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      // Ensure we have a participant ID
      getParticipantId();
      
      const room = await createRoom(duration);
      setRoomCode(room.code);
      setRoomId(room.id);
      
      // Store room info in session
      sessionStorage.setItem('currentRoomId', room.id);
      sessionStorage.setItem('currentRoomCode', room.code);
      sessionStorage.setItem('isCreator', 'true');
    } catch (error) {
      toast.error("Failed to create room. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!roomCode) return;
    
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      toast.success("Code copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy code");
    }
  };

  const handleEnterRoom = () => {
    if (roomCode) {
      navigate(`/chat/${roomCode}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-radial opacity-30" />
      
      <div className="relative z-10 min-h-screen flex flex-col px-6 py-8">
        {/* Header */}
        <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>

        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
          {!roomCode ? (
            // Duration selection
            <div className="w-full fade-in">
              <h1 className="text-2xl font-bold text-foreground mb-2 text-center">Create a Private Chat</h1>
              <p className="text-muted-foreground text-center mb-8">
                Choose how long your conversation will last
              </p>

              {/* Duration options */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {DURATION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDuration(option.value)}
                    className={`
                      relative p-4 rounded-xl border transition-all duration-300
                      ${duration === option.value 
                        ? 'bg-primary/10 border-primary text-primary shadow-ghost' 
                        : 'bg-surface border-border/50 text-foreground hover:border-primary/30'
                      }
                    `}
                  >
                    <Clock className={`w-5 h-5 mx-auto mb-2 ${duration === option.value ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="font-medium">{option.label}</span>
                    {duration === option.value && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              <Button
                variant="hero"
                size="xl"
                className="w-full"
                onClick={handleCreate}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Room"
                )}
              </Button>

              <p className="text-muted-foreground/60 text-sm text-center mt-6">
                When the timer ends, all messages will be permanently destroyed.
              </p>
            </div>
          ) : (
            // Room code display
            <div className="w-full fade-in text-center">
              <h1 className="text-2xl font-bold text-foreground mb-2">Your Room is Ready</h1>
              <p className="text-muted-foreground mb-8">
                Share this code with the person you want to chat with
              </p>

              {/* Code display */}
              <div className="bg-surface border border-border/50 rounded-2xl p-6 mb-6">
                <p className="text-muted-foreground text-sm mb-3">Room Code</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-4xl font-mono font-bold text-gradient-ghost tracking-[0.2em]">
                    {roomCode}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-primary" />
                    ) : (
                      <Copy className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>

              {/* Waiting indicator */}
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-8">
                <div className="w-2 h-2 bg-primary rounded-full pulse-ghost" />
                <span className="text-sm">Waiting for someone to join...</span>
              </div>

              <Button
                variant="hero"
                size="xl"
                className="w-full"
                onClick={handleEnterRoom}
              >
                Enter Chat Room
              </Button>

              <p className="text-muted-foreground/60 text-sm text-center mt-6">
                The room will expire in {duration} minutes after both participants join.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateRoom;