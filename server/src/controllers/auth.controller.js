// Controllers translate HTTP <-> service calls. No business logic and no SQL here.
import * as authService from '../services/auth.service.js';

export async function signup(req, res) {
  const { email, password } = req.body;
  res.status(201).json(await authService.signup(email, password));
}

export async function login(req, res) {
  const { email, password } = req.body;
  res.json(await authService.login(email, password));
}

export async function me(req, res) {
  res.json({ user: await authService.getUser(req.userId) });
}
