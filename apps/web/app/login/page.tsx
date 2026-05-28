import LoginForm from './LoginForm'

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoginForm next={next ?? '/dashboard'} />
    </div>
  )
}
