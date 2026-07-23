import { handleAuthRequest } from '../../src/lib/authApi'

function withPath(request: Request, pathname: string): Request {
  const url = new URL(request.url)
  url.pathname = pathname
  return new Request(url, request)
}

export default async (request: Request) => {
  return handleAuthRequest(withPath(request, '/api/auth/logout'), process.env)
}
