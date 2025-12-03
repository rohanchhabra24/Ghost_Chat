import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { joinRoom, getParticipantId } from "@/lib/room";
import { toast } from "sonner";

const JoinRoom = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleInputChange = (index: number, value: string) => {
    // Only allow alphanumeric
    const cleanValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (cleanValue.length <= 1) {
      const newCode = [...code];
      newCode[index] = cleanValue;
      setCode(newCode);
      setError(null);

      // Move to next input if value entered
      if (cleanValue && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Move to previous input on backspace if current is empty
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    
    // Submit on Enter if code is complete
    if (e.key === 'Enter' && code.every(c => c)) {
      handleJoin();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (pastedText.length >= 6) {
      const newCode = pastedText.slice(0, 6).split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
    }
  };

  const handleJoin = async () => {
    const roomCode = code.join('');
    
    if (roomCode.length !== 6) {
      setError('Please enter a complete 6-character code');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      // Ensure we have a participant ID
      getParticipantId();
      
      const result = await joinRoom(roomCode);
      
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else if (result.room) {
        // Store room info in session
        sessionStorage.setItem('currentRoomId', result.room.id);
        sessionStorage.setItem('currentRoomCode', result.room.code);
        sessionStorage.setItem('isCreator', 'false');
        
        toast.success("Joining room...");
        navigate(`/chat/${roomCode}`);
      }
    } catch {
      setError('Failed to join room. Please try again.');
      toast.error('Failed to join room');
    } finally {
      setIsJoining(false);
    }
  };

  const isCodeComplete = code.every(c => c);

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
          <div className="w-full fade-in text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Join a Chat</h1>
            <p className="text-muted-foreground mb-8">
              Enter the 6-character code to join the conversation
            </p>

            {/* Code input */}
            <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste}>
              {code.map((char, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  maxLength={1}
                  value={char}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={`
                    w-12 h-14 text-center text-2xl font-mono font-bold rounded-xl
                    bg-surface border-2 transition-all duration-200
                    focus:outline-none focus:border-primary focus:shadow-ghost
                    ${error ? 'border-danger' : char ? 'border-primary/50' : 'border-border'}
                    ${char ? 'text-foreground' : 'text-muted-foreground'}
                  `}
                  placeholder="•"
                />
              ))}
            </div>

            {/* Error message */}
            {error && (
              <p className="text-danger text-sm mb-6 animate-fade-in">{error}</p>
            )}

            {!error && (
              <p className="text-muted-foreground/60 text-sm mb-6">
                Codes are case-insensitive
              </p>
            )}

            <Button
              variant="hero"
              size="xl"
              className="w-full"
              onClick={handleJoin}
              disabled={!isCodeComplete || isJoining}
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  Join Room
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>

            <p className="text-muted-foreground/60 text-sm text-center mt-6">
              Make sure to enter the code exactly as shared by the room creator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinRoom;