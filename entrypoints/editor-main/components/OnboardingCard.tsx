export function OnboardingCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="pgve-onboarding">
      <h3>Welcome to Tweakpage</h3>
      <ol>
        <li>Move your mouse over the page and click to select an element.</li>
        <li>Switch to Browse to use the page normally (menus, tabs).</li>
        <li>Drag this panel by its title bar if it's in the way.</li>
      </ol>
      <button type="button" onClick={onDismiss}>Got it</button>
    </div>
  );
}
