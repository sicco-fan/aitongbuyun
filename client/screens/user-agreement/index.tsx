import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { createStyles } from './styles';

export default function UserAgreementScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Screen backgroundColor={theme.backgroundRoot}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ThemedText variant="bodyMedium" color={theme.textSecondary} style={styles.updateDate}>
          更新日期：2024年1月1日
        </ThemedText>

        <ThemedText variant="h3" color={theme.textPrimary} style={styles.title}>
          用户协议
        </ThemedText>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            重要提示
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            在使用本应用之前，请您务必仔细阅读并理解本用户协议。您使用本应用即表示您已阅读、理解并同意接受本协议的约束。如果您不同意本协议的任何条款，请勿使用本应用。
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            一、服务说明
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            1.1 本应用为用户提供英语学习服务，包括但不限于课程学习、语音识别、句库管理、错题练习等功能。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            1.2 我们保留随时修改、暂停或终止服务的权利，恕不另行通知。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            1.3 部分高级功能可能需要付费订阅才能使用，具体费用以应用内展示为准。
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            二、用户账户
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            2.1 您需要注册账户才能使用完整功能。您应当提供真实、准确的信息进行注册。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            2.2 您有责任保管好账户密码，因密码泄露导致的损失由您自行承担。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            2.3 您的账户仅限本人使用，不得转让、出售或出借给他人。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            2.4 如发现账户被盗用，请立即通知我们。
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            三、用户行为规范
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            您同意不会进行以下行为：
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 发布、传播违法违规内容
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 侵犯他人知识产权、隐私权等合法权益
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 干扰或破坏服务的正常运行
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 尝试破解、反编译或修改本应用
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 使用自动化脚本或程序访问服务
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 冒充他人身份或提供虚假信息
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            四、内容规范
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            4.1 您上传、分享的内容应符合法律法规，不得包含违法违规信息。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            4.2 您对上传的内容享有知识产权，同时授予我们全球性、非排他性的使用许可。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            4.3 我们有权删除违规内容，并视情节严重程度对账户进行处理。
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            五、知识产权
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            5.1 本应用的所有内容（包括但不限于软件、课程、音频、文字、图片）的知识产权归我们所有。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            5.2 未经书面授权，您不得复制、传播、展示、修改本应用的任何内容。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            5.3 用户上传的原创内容的知识产权归用户所有。
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            六、免责声明
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            6.1 我们不保证服务不会中断或没有错误，不对因网络状况等原因造成的服务中断负责。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            6.2 用户使用本应用产生的风险由用户自行承担。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            6.3 第三方链接或服务的内容和隐私政策不受我们控制，我们对此不承担任何责任。
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            七、服务终止
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            7.1 您可以随时注销账户并停止使用服务。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            7.2 如您违反本协议，我们有权暂停或终止您的账户，并删除相关数据。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            7.3 账户注销后，您的数据将被删除或匿名化处理。
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            八、协议修改
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            8.1 我们有权随时修改本协议，修改后的协议将在应用内公布。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            8.2 重大变更时，我们会通过弹窗或其他方式通知您。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            8.3 如您不同意修改后的协议，可以停止使用本应用。继续使用即表示您接受修改后的协议。
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            九、法律适用与争议解决
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            9.1 本协议适用中华人民共和国法律。
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            9.2 因本协议引起的争议，双方应友好协商解决；协商不成的，可向我们所在地人民法院提起诉讼。
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            十、联系我们
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            如您对本协议有任何疑问，请通过以下方式联系我们：
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 电子邮箱：support@example.com
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 客服电话：400-XXX-XXXX
          </ThemedText>
        </View>
      </ScrollView>
    </Screen>
  );
}
