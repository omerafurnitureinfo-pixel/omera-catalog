import { getSessionUserFromRequest } from "../../../lib/auth";
import { toRouteErrorMessage } from "../../../lib/db-error";

export async function GET(request: Request) {
  try {
    const user = await getSessionUserFromRequest(request);
    return Response.json({ user });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
