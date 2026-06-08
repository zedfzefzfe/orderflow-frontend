import Sidebar from './Sidebar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <div className="pl-16">{children}</div>
    </>
  )
}
