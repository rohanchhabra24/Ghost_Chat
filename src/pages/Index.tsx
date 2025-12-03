import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Ghost, Plus, ArrowRight, Shield, Clock, Eye } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-dark relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 bg-gradient-radial opacity-50" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-ghost/5 rounded-full blur-[100px]" />
      
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        {/* Logo and tagline */}
        <div className="text-center mb-16 fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-surface-elevated border border-border/50 mb-6 ghost-glow float">
            <Ghost className="w-10 h-10 text-ghost" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            <span className="text-gradient-ghost">Ghost</span>
            <span className="text-foreground">Chat</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Private conversations that vanish without a trace. No accounts. No history. Just talk.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-4 w-full max-w-xs mb-16 slide-up" style={{ animationDelay: '0.2s' }}>
          <Link to="/create">
            <Button variant="hero" size="xl" className="w-full">
              <Plus className="w-5 h-5 mr-2" />
              Create a Chat
            </Button>
          </Link>
          <Link to="/join">
            <Button variant="glass" size="xl" className="w-full">
              <ArrowRight className="w-5 h-5 mr-2" />
              Join a Chat
            </Button>
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl w-full slide-up" style={{ animationDelay: '0.4s' }}>
          <FeatureCard
            icon={<Shield className="w-5 h-5" />}
            title="No Identity"
            description="No accounts, no phone numbers, no trace."
          />
          <FeatureCard
            icon={<Clock className="w-5 h-5" />}
            title="Self-Destructing"
            description="Messages vanish when the timer ends."
          />
          <FeatureCard
            icon={<Eye className="w-5 h-5" />}
            title="Untraceable"
            description="End-to-end encrypted and ephemeral."
          />
        </div>

        {/* Footer */}
        <p className="text-muted-foreground/50 text-sm mt-16 text-center max-w-md">
          Your conversation exists only while the timer runs. When it ends, everything disappears forever.
        </p>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="bg-surface/40 backdrop-blur-sm border border-border/30 rounded-xl p-5 text-center hover:border-primary/30 transition-colors duration-300">
    <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary mb-3">
      {icon}
    </div>
    <h3 className="font-medium text-foreground mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

export default Index;