// Every repository function that touches journal data calls this first.
// A missing userId is a programming error, so it fails loudly instead of running an unscoped query.
export function assertUserId(userId) {
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('Repository called without a userId: refusing to run an unscoped query');
  }
}
