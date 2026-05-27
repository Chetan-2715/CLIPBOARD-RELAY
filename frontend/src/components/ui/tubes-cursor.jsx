import React, { useEffect, useRef } from 'react';

// The main App component that encapsulates the cursor animation
export default function TubesCursor({ 
  showOverlay = false, 
  className = "fixed inset-0 pointer-events-none z-0" 
}) {
  // useRef to get a persistent reference to the canvas element
  const canvasRef = useRef(null);
  // useRef to hold the animation instance so we can call its methods
  const appRef = useRef(null);

  /**
   * Generates an array of random hex color strings.
   * @param {number} count - The number of random colors to generate.
   * @returns {string[]} An array of color strings.
   */
  const randomColors = (count) => {
    return new Array(count)
      .fill(0)
      .map(() => "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'));
  };

  // This effect runs once when the component mounts
  useEffect(() => {
    // Delaying the initialization with setTimeout ensures the DOM is fully painted
    const initTimer = setTimeout(() => {
      import('https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js')
        .then(module => {
          const TubesCursorAnim = module.default;
          
          // Ensure the canvas element is still available before initializing
          if (canvasRef.current) {
            // Initialize the TubesCursor animation
            const app = TubesCursorAnim(canvasRef.current, {
              tubes: {
                colors: ["#a855f7", "#ec4899", "#3b82f6"],
                lights: {
                  intensity: 220,
                  colors: ["#a855f7", "#ec4899", "#3b82f6", "#10b981"]
                }
              }
            });
            // Store the instance in our ref for later use
            appRef.current = app;
          }
        })
        .catch(err => console.error("Failed to load TubesCursor module:", err));
    }, 100);

    // Cleanup function to dispose of the animation and clear the timeout
    return () => {
      clearTimeout(initTimer);
      // Check if app was initialized and has a dispose method before calling
      if (appRef.current && typeof appRef.current.dispose === 'function') {
        appRef.current.dispose();
      }
    };
  }, []);

  // Handles click events on the main container
  const handleClick = () => {
    if (appRef.current) {
      const newTubeColors = randomColors(3);
      const newLightColors = randomColors(4);
      
      // Update the colors in the running animation
      appRef.current.tubes.setColors(newTubeColors);
      appRef.current.tubes.setLightsColors(newLightColors);
    }
  };

  if (!showOverlay) {
    return <canvas ref={canvasRef} className={className} />;
  }

  return (
    // Main container with full-screen styles and click handler
    <div
      onClick={handleClick}
      className="h-screen w-screen bg-black font-['Montserrat',_sans-serif] overflow-hidden cursor-pointer"
    >
      {/* Canvas element for the animation, positioned behind everything else */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0" />
      
      {/* Hero content displayed over the canvas */}
      <div className="relative h-full flex flex-col items-center justify-center gap-2.5 z-10">
        <h1 className="m-0 p-0 text-white text-[80px] font-bold uppercase leading-none select-none [text-shadow:0_0_20px_rgba(0,0,0,1)]">
          Tubes
        </h1>
        <h2 className="m-0 p-0 text-white text-[60px] font-medium uppercase leading-none select-none [text-shadow:0_0_20px_rgba(0,0,0,1)]">
          Cursor
        </h2>
        <p className="m-0 p-0 text-white text-xl leading-none select-none [text-shadow:0_0_20px_rgba(0,0,0,1)]">
          Click to change colors
        </p>
      </div>
    </div>
  );
}
