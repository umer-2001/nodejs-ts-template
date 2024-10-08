import { NextFunction, Request, Response } from "express";
import User, { IUser } from "../models/User/user.model";
import sendMail from "../utils/sendMail";
import SuccessHandler from "../utils/SuccessHandler";
import ErrorHandler from "../utils/ErrorHandler";
import validator from "validator";

interface CustomRequest extends Request {
  user: any;
}

//register
const register = async (req: Request, res: Response): Promise<any> => {
  // #swagger.tags = ['auth']
  try {
    const { name, email, password, role } = req.body;
    if (!validator.isEmail(email)) {
      return ErrorHandler("Invalid email format", 400, req, res);
    }
    if (
      !password.match(
        /(?=[A-Za-z0-9@#$%^&+!=]+$)^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@#$%^&+!=])(?=.{8,}).*$/
      )
    ) {
      return ErrorHandler(
        "Password must contain atleast one uppercase letter, one special character and one number",
        400,
        req,
        res
      );
    }
    const user = await User.findOne({ email });
    if (user) {
      return ErrorHandler("User already exists", 400, req, res);
    }
    const newUser: IUser = await User.create({
      name,
      email,
      password,
      role,
    });
    newUser.save();
    return SuccessHandler("User created successfully", 200, res);
  } catch (error: any) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

//request email verification token
const requestEmailToken = async (req: Request, res: Response): Promise<any> => {
  // #swagger.tags = ['auth']

  try {
    const { email } = req.body;
    if (!validator.isEmail(email)) {
      return ErrorHandler("Invalid email format", 400, req, res);
    }
    const user = await User.findOne({ email });
    if (!user) {
      return ErrorHandler("User does not exist", 400, req, res);
    }
    const emailVerificationToken = Math.floor(100000 + Math.random() * 900000);
    const emailVerificationTokenExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.emailVerificationToken = emailVerificationToken;
    user.emailVerificationTokenExpires = emailVerificationTokenExpires;
    await user.save();
    const message = `Your email verification token is ${emailVerificationToken} and it expires in 10 minutes`;
    const subject = `Email verification token`;
    await sendMail(email, subject, message);
    return SuccessHandler(
      `Email verification token sent to ${email}`,
      200,
      res
    );
  } catch (error: any) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

//verify email token
const verifyEmail = async (req: Request, res: Response): Promise<any> => {
  // #swagger.tags = ['auth']

  try {
    let jwtToken: string | undefined;
    const { email, emailVerificationToken } = req.body;
    if (!validator.isEmail(email)) {
      return ErrorHandler("Invalid email format", 400, req, res);
    }
    const user: IUser | any = await User.findOne({ email });
    if (!user) {
      return ErrorHandler("User does not exist", 404, req, res);
    }
    if (
      user.emailVerificationToken !== emailVerificationToken ||
      user.emailVerificationTokenExpires < Date.now()
    ) {
      return ErrorHandler("Invalid token", 400, req, res);
    }
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpires = null;
    jwtToken = user.getJWTToken();
    await user.save();
    return SuccessHandler("Email verified successfully", 200, res);
  } catch (error: any) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

//login
const login = async (req: Request, res: Response): Promise<any> => {
  // #swagger.tags = ['auth']

  try {
    let jwtToken: string | null;
    const { email, password } = req.body;
    if (!validator.isEmail(email)) {
      return ErrorHandler("Invalid email format", 400, req, res);
    }
    const user: IUser | any = await User.findOne({ email }).select("+password");
    if (!user) {
      return ErrorHandler("User does not exist", 400, req, res);
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return ErrorHandler("Invalid credentials", 400, req, res);
    }
    if (!user.emailVerified) {
      return ErrorHandler("Email not verified", 400, req, res);
    }
    jwtToken = user.getJWTToken();
    return SuccessHandler(
      { message: "Logged in successfully", jwtToken, user },
      200,
      res
    );
  } catch (error: any) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

//logout
const logout = async (req: CustomRequest, res: Response): Promise<any> => {
  // #swagger.tags = ['auth']

  try {
    req.user = null;
    return SuccessHandler("Logged out successfully", 200, res);
  } catch (error: any) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

//forgot password
const forgotPassword = async (req: Request, res: Response): Promise<any> => {
  // #swagger.tags = ['auth']

  try {
    const { email } = req.body;
    if (!validator.isEmail(email)) {
      return ErrorHandler("Invalid email format", 400, req, res);
    }
    const user = await User.findOne({ email });
    if (!user) {
      return ErrorHandler("User does not exist", 400, req, res);
    }
    const passwordResetToken = Math.floor(100000 + Math.random() * 900000);
    const passwordResetTokenExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.passwordResetToken = passwordResetToken;
    user.passwordResetTokenExpires = passwordResetTokenExpires;
    await user.save();
    const message = `Your password reset token is ${passwordResetToken} and it expires in 10 minutes`;
    const subject = `Password reset token`;
    await sendMail(email, subject, message);
    return SuccessHandler(`Password reset token sent to ${email}`, 200, res);
  } catch (error: any) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

//reset password
const resetPassword = async (req: Request, res: Response): Promise<any> => {
  // #swagger.tags = ['auth']

  try {
    const { email, passwordResetToken, password } = req.body;
    if (!validator.isEmail(email)) {
      return ErrorHandler("Invalid email format", 400, req, res);
    }
    const user: IUser | any = await User.findOne({ email }).select("+password");
    if (!user) {
      return ErrorHandler("User does not exist", 400, req, res);
    }
    if (
      user.passwordResetToken !== passwordResetToken ||
      user.passwordResetTokenExpires < Date.now()
    ) {
      return ErrorHandler("Invalid token", 400, req, res);
    }
    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetTokenExpires = null;
    await user.save();
    return SuccessHandler("Password reset successfully", 200, res);
  } catch (error: any) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

//update password
const updatePassword = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  // #swagger.tags = ['auth']

  try {
    const { currentPassword, newPassword } = req.body;
    if (
      !newPassword.match(
        /(?=[A-Za-z0-9@#$%^&+!=]+$)^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@#$%^&+!=])(?=.{8,}).*$/
      )
    ) {
      return ErrorHandler(
        "Password must contain at least 8 characters, 1 uppercase, 1 lowercase, 1 number and 1 special character",
        400,
        req,
        res
      );
    }
    const user: IUser | any = await User.findById(req.user.id).select(
      "+password"
    );
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return ErrorHandler("Invalid credentials", 400, req, res);
    }
    const samePasswords = await user.comparePassword(newPassword);
    if (samePasswords) {
      return ErrorHandler(
        "New password cannot be same as old password",
        400,
        req,
        res
      );
    }
    user.password = newPassword;
    await user.save();
    return SuccessHandler("Password updated successfully", 200, res);
  } catch (error: any) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const socialAuth = async (req: Request, res: Response): Promise<any> => {
  // #swagger.tags = ['auth']
  try {
    const { email, name, role, provider } = req.body;

    const exUser: IUser | any = await User.findOne({ email });
    if (
      exUser &&
      (exUser.provider === "google" || exUser.provider === "apple")
    ) {
      const token = await exUser.getJWTToken();
      return SuccessHandler({ token, user: exUser }, 200, res);
    } else if (
      exUser &&
      exUser.provider !== "google" &&
      exUser.provider !== "apple"
    ) {
      return ErrorHandler(
        "User exists with different provider. Use the one you used before",
        400,
        req,
        res
      );
    } else {
      const user: IUser | any = await User.create({
        email,
        name,
        role,
        provider,
      });
      const token = await user.getJWTToken();
      return SuccessHandler({ token, user }, 200, res);
    }
  } catch (error: any) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

export {
  register,
  requestEmailToken,
  verifyEmail,
  login,
  logout,
  forgotPassword,
  resetPassword,
  updatePassword,
  socialAuth,
};
