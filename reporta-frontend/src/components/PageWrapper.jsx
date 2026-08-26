export default function PageWrapper({ children }) {
  return (
    <div className="pt-16"> {/* Padding for fixed navbar */}
      {children}
    </div>
  );
}
