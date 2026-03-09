export default function HomePage() {
  const { redirect } = require('next/navigation');
  redirect('/products');
}
