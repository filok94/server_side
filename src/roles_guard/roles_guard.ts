import { UserService } from "./../users/user.service";
import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { TokenService } from "src/auth/token.service";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tokenService: TokenService,
    private userService: UserService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.get<string[]>("roles", context.getHandler());
    const request = context.switchToHttp().getRequest();
    const token = request.headers.token;
    if (!roles) {
      return true;
    }
    const userId = await this.tokenService.getUserByToken(token);
    const user = await this.userService.getUserById(userId);
    return user.is_admin;
  }
}