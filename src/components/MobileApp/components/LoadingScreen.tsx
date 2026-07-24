import l3l3 from '../../game/images/l3l3.png';

export function LoadingScreen() {

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <div className="flex flex-col justify-center items-center">
        <div className="relative flex justify-center">
          <img
            src={l3l3}
            alt="L3L3 Logo"
            style={{ imageRendering: 'pixelated', width: '250px' }}
          />
        </div>

        <div
          className="font-pixel text-xl uppercase tracking-wider text-center text-foreground mt-8"
          data-testid="text-loading"
        >
          LOADING DATA...
        </div>

        <div className="flex justify-center gap-2 mt-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-sm bg-primary"
              style={{
                animation: `pulse 1.5s ease-in-out infinite`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
