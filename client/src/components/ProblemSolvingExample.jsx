import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import exampleCircuit from '../assets/images/equivalent-resistor-example.png';

export default function ProblemSolvingExample({ withLabel = false }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <span className="app-problem-example__control">
        {withLabel && (
          <span className="app-problem-example__inline-label">Need a worked example?</span>
        )}
        <button
          type="button"
          className="app-problem-example__trigger"
          title="See a worked example"
          aria-label="See a worked example"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          ?
        </button>
      </span>

      {open &&
        createPortal(
          <div
            className="app-modal-overlay app-problem-example__overlay"
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              className="app-problem-example__dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="app-modal-close-button"
                onClick={() => setOpen(false)}
                aria-label="Close example"
              >
                ×
              </button>

              <h2 id={titleId} className="app-problem-example__title">
                Find the equivalent resistor in this circuit.
              </h2>

              <img
                src={exampleCircuit}
                alt="Circuit with voltage source vs, resistors R1 = 4Ω, R2 = 2Ω, R3 = 6Ω, and nodes A and B with ground at B"
                className="app-problem-example__figure"
              />

              <p className="app-problem-example__section">
                <span className="app-problem-example__label">Goal:</span>{' '}
                Find a resistor that can be replaced by existing resistor. This resistor will draw the same current from the voltage source.
              </p>

              <p className="app-problem-example__section">
                <span className="app-problem-example__label">Explicit information,</span>{' '}
                aka What information do we have just by looking at the circuit?
              </p>
              <ul className="app-problem-example__list">
                <li>We have a resistive circuit. We don&apos;t have the value of the voltage source (V<sub>s</sub>).</li>
                <li>Resistors are connected in series and parallel.</li>
                <li>This circuit has three nodes, A, B, and the node between R2 and R3, let&apos;s call it C.</li>
                <li>
                  V<sub>b</sub> is connected to ground, hence V<sub>b</sub>=0. (we might not use this information in this question, but we observe and record it)
                </li>
                <li>
                  Ground node is connected to terminal B of the voltage source which means the voltage at terminal B is zero. (we might not use this information in this question, but we observe and record it)
                </li>
                <li>Voltage at node A is equal to V<sub>s</sub>.</li>
              </ul>

              <p className="app-problem-example__section">
                <span className="app-problem-example__label">Implicit information,</span>{' '}
                aka hidden information. What do we know from before that can give us more insight into this problem?
              </p>
              <ul className="app-problem-example__list">
                <li>We can use ohm&apos;s law in resistive circuits to find the relationship between voltage, current, and resistance.</li>
                <li>We learned how to combine parallel and series resistor together.</li>
                <li>If we know the value of the voltage source, we can find voltage at C using Ohm&apos;s law.</li>
              </ul>

              <p className="app-problem-example__section">
                <span className="app-problem-example__label">Solution in your word (in English)</span>
              </p>
              <p>
                Since the voltage source is on the left side of the circuit, we need to find what resistance the voltage source sees from the right side of the circuit. We can combine the resistors from the left side of the circuit to the right using parallel and series formulas until we get one resistor.
              </p>
              <p>
                We will add R2 and R3 in series, we call this Req1. We see that Req1 is in parallel with R1, we combine them using parallel formula and call it Req and vola! We have only one resistor left and we stop here.
              </p>

              <p className="app-problem-example__section">
                <span className="app-problem-example__label">Mathematical solution</span>
              </p>
              <p>
                R<sub>eq1</sub> = R<sub>2</sub> + R<sub>3</sub> = 2 + 6 = 8Ω
              </p>
              <p>
                R<sub>eq</sub> = (R<sub>eq1</sub> R<sub>1</sub>) / (R<sub>eq1</sub> + R<sub>1</sub>) = (8 × 4) / (8 + 4) = 2.6 Ω
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
