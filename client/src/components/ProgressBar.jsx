import { useRef, useEffect, useState } from 'react';
import Confetti from 'react-confetti-boom';

function ProgressBar(props) {
    const { name, progress } = props;
    const barRef = useRef(null);
    const textRef = useRef(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const opacity = Math.sqrt(progress / 100);

    const getProgressMessage = (percentage) => {
        if (percentage === 100) {
            return "Congratulations! You've mastered this concept!";
        } else if (percentage >= 80) {
            return "Excellent — you're almost there!";
        } else if (percentage >= 60) {
            return "Good work — keep going!";
        } else {
            return "Still growing — let's give it some extra time!";
        }
    };

    useEffect(() => {
        if (barRef.current) {
            barRef.current.style.width = `${progress}%`;
            barRef.current.style.backgroundColor = `rgba(0, 128, 0, ${opacity})`;
            
            // Change text color based on progress
            if (textRef.current) {
                if (progress >= 80) {
                    textRef.current.style.color = 'white';
                } else {
                    textRef.current.style.color = 'black';
                }
            }
        }
    }, [progress, opacity]);

    const handleMouseEnter = () => {
        if (progress === 100){
        setShowConfetti(true);
    }
    };

    const handleMouseLeave = () => {
        setShowConfetti(false);
    };

    return (
        <>
        {showConfetti && (
            <Confetti mode="boom" particleCount={50} colors={['#ff577f', '#ff884b']} />
        )}
        <div 
            className="ba-progress-container bux-grid__cell--12@sm bux-grid__cell--6@md bux-grid__cell--4@lg bux-mar-all-sp-4"
            data-message={getProgressMessage(progress)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div ref={textRef} className='ba-progress-fill-text'>{name}</div>
            <div ref={barRef} className="ba-progress-fill"></div>
        </div>
        </>
    );
}

export default ProgressBar;