export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-4">
          Welcome to RPGate
        </h1>
        <p className="text-center text-muted-foreground">
          AI-Powered Multiplayer Tabletop RPG Platform
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-2">Chat Rooms</h2>
            <p className="text-sm text-muted-foreground">
              Join multiplayer chat rooms for collaborative storytelling
            </p>
          </div>
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-2">AI Game Master</h2>
            <p className="text-sm text-muted-foreground">
              Let AI guide your D&D adventures as the Game Master
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
