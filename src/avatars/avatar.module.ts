import { ValidateLinkConstraint } from "./validators/validate_link";
import { AuthModule } from "./../auth/auth.module";
import { AvatarService } from "./avatar.service";
import { AvatarController } from "./avatar.controller";
import {
  Avatar,
  AvatarSchema,
  AvatarProps,
  AvatarPropsSchema,
  UserAvatar,
  UserAvatarSchema,
} from "./schemas/avatar.schema";
import { MongooseModule } from "@nestjs/mongoose";

import { Module } from "@nestjs/common";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Avatar.name, schema: AvatarSchema },
      { name: AvatarProps.name, schema: AvatarPropsSchema },
      { name: UserAvatar.name, schema: UserAvatarSchema },
    ]),
    AuthModule,
  ],
  controllers: [AvatarController],
  providers: [AvatarService, ValidateLinkConstraint],
  exports: [AvatarService],
})
export class AvatarModule {}
