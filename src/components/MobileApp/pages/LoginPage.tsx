import { useLocation } from "wouter";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { LoadingScreen } from "../components/LoadingScreen";
import { useAuth } from "../hooks/useAuth";
import { OAUTH_PROVIDERS, startOAuthLogin } from "../../../shared/authClient";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { authenticated, username, discriminator, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  return (
    <main className="relative z-10 pt-24 pb-6">
      <div className="container mx-auto px-4 max-w-md pt-4 md:pt-0">
        <Card className="relative overflow-hidden border-2 border-primary/40 bg-card/95 backdrop-blur-sm p-6 shadow-lg shadow-primary/20 mt-20">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <div className="relative z-10">
            {authenticated ? (
              <div className="text-center space-y-4">
                <p className="font-retro text-md text-foreground">
                  Logged in as{" "}
                  <span className="text-primary">
                    {username}#{discriminator}
                  </span>
                </p>
                <Button
                  className="w-full font-retro uppercase tracking-wide"
                  onClick={() => navigate("/dashboard")}
                  data-testid="button-back-to-dashboard"
                >
                  Back to Dashboard
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="font-pixel text-lg text-primary text-center mb-4">LOG IN</h2>
                {OAUTH_PROVIDERS.map((provider) => (
                  <Button
                    key={provider.id}
                    className="w-full font-retro uppercase tracking-wide"
                    onClick={() => startOAuthLogin(provider.id, "dashboard")}
                    data-testid={`button-login-${provider.id}`}
                  >
                    {provider.label}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  className="w-full font-retro uppercase tracking-wide"
                  onClick={() => navigate("/dashboard")}
                  data-testid="button-continue-as-guest"
                >
                  Continue as Guest
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
