export function LevelUpScreen({ choices, onChoice }) {
  return (
    <div className="overlay level-up-overlay">
      <div className="level-up-box">
        <h2 className="level-up-title">LEVEL UP!</h2>
        <p className="level-up-subtitle">Choose an upgrade</p>
        <div className="upgrade-choices">
          {choices.map((choice) => (
            <button
              key={choice.id}
              className="upgrade-card"
              onClick={() => onChoice(choice)}
            >
              <div className="upgrade-name">{choice.name}</div>
              <div className="upgrade-desc">{choice.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
