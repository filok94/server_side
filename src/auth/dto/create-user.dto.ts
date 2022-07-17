import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class UserDto {
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  @IsString()
  login: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
